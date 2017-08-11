(function(Backbone) {
    if (Backbone && Backbone.ChildViewContainer) {
        _.extend(Backbone.ChildViewContainer.prototype, {
            indexOf: function(view) {
                return _.values(this._views).indexOf(view)
            }
        })
    }
    Backbone.Model.prototype.put = function(prop, options) {
        if (this.isNew()) {
            return this.save.apply(this, arguments)
        }
        var attrs = _.isString(prop) ? _.object([
            [prop, this.get(prop)]
        ]) : prop;
        options = _(options || {}).extend({
            attrs: attrs
        });
        return this.save(prop, options)
    };
    Backbone.Model.prototype.toggle = function(prop) {
        this.set(prop, !this.get(prop))
    }
})(Backbone);
momodule("mopub.utilities", function(exports) {
    var default_metrics = exports.default_metrics = ["revenue", "impressions", "ecpm", "attempts", "clicks", "ctr", "fill_rate", "total_fill_rate"];
    exports.standard_metrics = _(default_metrics).without("total_fill_rate");
    var GRAPH_COVER_CLASS = "dashboard-cover";
    exports.Dashboard = {
        default_metrics: default_metrics,
        build_query_dates: function(query_type, start_date, end_date) {
            var query_types = morequire("mopub.utilities.DashboardConstants.query_types");
            var start = moment(start_date);
            var end = moment(end_date);
            if (query_type === query_types.historical) {
                var date_range = end.diff(start) / (1e3 * 60 * 60 * 24);
                start.subtract("days", date_range + 1);
                end.subtract("days", date_range + 1)
            }
            return {
                start: start,
                end: end
            }
        },
        trackSheet: function(event, model) {
            mixpanel.track(event, {
                campaignType: model.get("campaign_type"),
                adgroupType: model.get("adgroup_type")
            })
        },
        toggle_loading_state_on: function() {
            var graph_cover = $("." + GRAPH_COVER_CLASS);
            graph_cover.css("pointer-events", "all");
            graph_cover.fadeIn(150, function() {})
        },
        toggle_loading_state_off: function() {
            var graph_cover = $("." + GRAPH_COVER_CLASS);
            setTimeout(function() {
                graph_cover.fadeOut(200, function() {
                    graph_cover.css("pointer-events", "none")
                })
            }, 100)
        },
        format: function(decimal_places, string) {
            return (string * 100).toFixed(decimal_places) + "%"
        },
        short_kmbt: function(value) {
            var kmbt_value = Formatting.format_kmbt(value, 1);
            if (kmbt_value.length > 5) {
                return Formatting.format_kmbt(value, 0)
            } else {
                return kmbt_value
            }
        },
        format_field_func: function(field, use_kmbt) {
            var that = this;
            if (field === "revenue" || field === "ecpm") {
                if (use_kmbt) {
                    return function(value) {
                        if (value >= 1e3) {
                            return "$" + that.short_kmbt(value)
                        } else {
                            return mopub.Utils.formatCurrency(value)
                        }
                    }
                } else {
                    return mopub.Utils.formatCurrency
                }
            } else if (field === "ctr") {
                return _.partial(this.format, 2)
            } else if (field === "fill_rate" || field === "total_fill_rate") {
                return _.partial(this.format, 0)
            } else if (field === "impressions" || field === "clicks" || field === "attempts") {
                if (use_kmbt) {
                    return function(value) {
                        if (value >= 1e3) {
                            return that.short_kmbt(value)
                        } else {
                            return mopub.Utils.formatNumberWithCommas(value)
                        }
                    }
                } else {
                    return mopub.Utils.formatNumberWithCommas
                }
            } else {
                return _.identity
            }
        },
        format_percent_change: function(value) {
            var formatted_val;
            if (value > 0) {
                formatted_val = "+"
            } else {
                formatted_val = ""
            }
            var base_number;
            if (Math.abs(value) < 10) {
                base_number = value.toFixed(1)
            } else if (Math.abs(value) < 1e3) {
                base_number = value.toFixed(0)
            } else {
                if (value > 0) {
                    base_number = Formatting.format_kmbt(value, 0)
                } else {
                    base_number = "-" + Formatting.format_kmbt(-value, 0)
                }
            }
            formatted_val += base_number + "%";
            return formatted_val
        },
        combine_predicates: function() {
            var funcs = Array.prototype.slice.call(arguments);
            return function(arg) {
                return _.all(_.map(funcs, function(func) {
                    return func(arg)
                }))
            }
        },
        extractPublisherFilters: function(filterList) {
            var publisherFilters = ["app", "adunit", "adunit_format", "platform"];
            return _.filter(filterList, function(filterObj) {
                return _.contains(publisherFilters, filterObj.dimension)
            })
        },
        joinQueries: function(originalPromise, correctPromise, groupingNames, columnName) {
            return Future.map(Future.join(originalPromise, correctPromise), function(original, correctData) {
                original = original[0];
                correctData = correctData[0];
                _.each(groupingNames, function(groupingName) {
                    var correctValueIndex = correctData.results[groupingName].columns.indexOf(columnName);
                    var erroneousValueIndex = original.results[groupingName].columns.indexOf(columnName);
                    if (original.results[groupingName].rows.length && correctData.results[groupingName].rows.length && original.results[groupingName].rows.length == correctData.results[groupingName].rows.length) {
                        var i;
                        for (i = 0; i < original.results[groupingName].rows.length; i++) {
                            original.results[groupingName].rows[i][erroneousValueIndex] = correctData.results[groupingName].rows[i][correctValueIndex]
                        }
                    }
                });
                return original
            })
        }
    }
});
momodule("mopub.utilities", function(exports) {
    exports.DashboardConstants = {
        WHITELISTED_METRICS: ["adsource", "attempts", "clicks", "ctr", "ecpm", "fill_rate", "impressions", "revenue", "total_fill_rate"],
        APPORTIONED_DATA_NOTE: "networks_data_calculated",
        ESTIMATED_DATA_NOTE: "networks_data_from_adserver",
        ADGROUP_TYPE_MAPPING: {
            gtee: "Guaranteed",
            promo: "Promotional",
            pmp_line_item: "Private Marketplace",
            mpx_line_item: "Marketplace Line Item",
            marketplace: "Marketplace",
            non_gtee: "Non-Guaranteed",
            network: "Networks",
            backfill_promo: "Backfill Promo"
        },
        query_types: {
            normal: 0,
            historical: 1
        }
    };
    exports.Constants = {
        disabledFieldTooltips: {
            bid_strategy: "You cannot change the Rate type once a Line Item has started. Copy or create a new Line Item to change the Rate type.",
            budget_type: "You cannot change the Budgeting metric once a Line Item has started. Copy or create a new Line Item to change the Budgeting metric."
        },
        hovers: {
            hoverText: {
                revenue: {
                    custom: "Revenue Reporting is unavailable for Custom or Custom Native Networks. This revenue estimate is based on the CPMs you entered. All other metrics, such as impressions and attempts, are based on your ad serving activity.",
                    credentials: "Network Reporting is unavailable. This revenue estimate is based on the CPMs you entered. All other metrics such as impressions and attempts are based on your ad serving activity.",
                    apportioned: "This ad network does not provide data at this level of detail. This revenue estimate is based on the CPMs you entered. All other metrics, such as impressions and attempts, are based on your ad serving activity."
                },
                ecpm: {
                    custom: "Network Reporting is unavailable for Custom or Custom Native Networks. Your eCPM is calculated based on estimated revenue divided by impressions from your ad serving activity.",
                    credentials: "Network Reporting is unavailable. Your eCPM is calculated based on estimated revenue divided by impressions from your ad serving activity.",
                    apportioned: "This ad network does not provide data at this level of detail. Your eCPM is calculated based on estimated revenue divided by impressions from your ad serving activity."
                }
            },
            errorTypeDict: {
                unavailable: "custom",
                error: "credentials"
            },
            metricNameToTitle: {
                ecpm: "Estimated eCPM",
                revenue: "Estimated Revenue"
            }
        },
        dates: {
            epoch_start: new Date(1970, 1, 1),
            epoch_end: new Date(2100, 1, 1)
        }
    };
    exports.RedirectConstants = {
        REDIRECTS_ON_ACCOUNT_SWITCH: {
            "/dashboard/": "/dashboard/",
            "/inventory/": "/apps/",
            "/advertise/orders/": "/orders/",
            "/advertise/line_items/": "/orders/",
            "/advertise/marketplace/": "/advertise/marketplace/",
            "/networks/v2/": "/networks/v2/"
        }
    }
});
momodule("mopub.utilities", function(exports) {
    exports.FilteredCollection = function(original, options) {
        var originalModels = _.isUndefined(original.models) ? [] : original.models,
            filtered = new original.constructor(originalModels, options);
        filtered.original = original;
        filtered._callbacks = {};
        filtered.filter = function(func, options) {
            var items = func && _.isFunction(func) ? original.filter(func) : original.models;
            filtered._currentCriteria = func;
            Backbone.Collection.prototype.reset.call(filtered, items, options)
        };
        filtered.applyFilters = function(filters) {
            var that = this;
            this.filters = filters;
            this.filter(function(model) {
                for (var key in filters) {
                    if (filters.hasOwnProperty(key)) {
                        if (!that.orFilter(that.filters, key, model)) {
                            return false
                        }
                    }
                }
                return true
            })
        };
        filtered.filterAll = function() {
            this.filter(function(model) {
                return false
            })
        };
        filtered.orFilter = function(filters, key, model) {
            if (filters[key] && filters[key].length && model.has(key)) {
                if (_.intersection(filters[key], _.flatten([model.get(key)])).length === 0) {
                    return false
                }
            }
            return true
        };
        filtered.fetch = function(options) {
            return original.fetch(options)
        };
        filtered.reset = function(models, options) {
            return original.reset(models, options)
        };
        filtered.applyData = function(dataServiceResponse) {
            return original.applyData(dataServiceResponse)
        };
        original.on("reset", function() {
            filtered.filter(filtered._currentCriteria)
        });
        return filtered
    };
    exports.IndexedCollection = function(original, by) {
        var indexed = new original.constructor;
        original.on("reset", function(collection, options) {
            collection.each(_indexModel)
        });
        original.on("add", function(model) {
            _indexModel(model)
        });
        original.on("remove", function(model) {
            delete indexed[by][model.get(by)]
        });
        _indexModel = function(model) {
            indexed[by] = indexed[by] || {};
            indexed[by][model.get(by)] = model
        };
        return indexed
    }
});
momodule("mopub.utilities", function(exports) {
    var dFilter = function(dimension, operation, values) {
        return {
            dimension: dimension,
            operation: operation,
            values: values
        }
    };
    var dAggregation = function(name, groupBy, includeEstimates) {
        return {
            name: name,
            group_by: groupBy,
            include_estimates: includeEstimates || false
        }
    };
    var Query = function(options) {
        var query = options.query;
        var dataServiceUrl = options.dataServiceUrl;
        var dataServiceKey = options.dataServiceKey;
        var dataPath = options.dataPath;
        this.inspect = function() {
            return mori.clj_to_js(query)
        };
        this.aggregations = function() {
            var newAggregations = Array.prototype.slice.call(arguments).map(_.splat(dAggregation));
            return new Query({
                dataServiceUrl: dataServiceUrl,
                dataServiceKey: dataServiceKey,
                dataPath: dataPath,
                query: mori.assoc(query, "aggregations", mori.into(mori.get(query, "aggregations"), mori.js_to_clj(newAggregations)))
            })
        };
        this.filters = function() {
            var newFilters = Array.prototype.slice.call(arguments).map(_.splat(dFilter));
            return new Query({
                dataServiceKey: dataServiceKey,
                dataServiceUrl: dataServiceUrl,
                dataPath: options.dataPath,
                query: mori.assoc(query, "filters", mori.into(mori.get(query, "filters"), mori.js_to_clj(newFilters)))
            })
        };
        this.metrics = function() {
            var newMetrics = mori.set(Array.prototype.slice.call(arguments));
            var allMetrics = mori.into(mori.get(query, "metrics"), newMetrics);
            return new Query({
                dataServiceKey: dataServiceKey,
                dataServiceUrl: dataServiceUrl,
                dataPath: dataPath,
                query: mori.assoc(query, "metrics", allMetrics)
            })
        };
        this.execute = function() {
            var xhr = $.post("{}{}".format(dataServiceUrl, dataPath), {
                query: JSON.stringify(this.inspect()),
                key: dataServiceKey,
                gargoyle_flags: JSON.stringify({
                    use_pubstats_cluster: mopub.gargoyle.isSwitchEnabled("use_pubstats_cluster"),
                    use_cache: mopub.gargoyle.isSwitchEnabled("use_dataservice_cache")
                })
            }, null, "json");
            var fc = function(jobLocation) {
                return $.ajax({
                    url: "{}{}".format(dataServiceUrl, jobLocation),
                    dataType: "json",
                    timeout: 2e3
                })
            }.bind(this);
            return Future.flatMap(xhr, function(responseText, status, xhr) {
                var retryInterval = 2e3;
                var maxAttempts = 30 * 60 * 1e3 / retryInterval;
                if (xhr.status === 202) {
                    return Future.retryWithConstantBackoff(_.partial(fc, xhr.getResponseHeader("Location")), retryInterval, maxAttempts)
                } else {
                    return xhr
                }
            })
        };
        this.splat = function(fnName) {
            return _.splat(this[fnName], this)
        }
    };
    exports.Query = function(options) {
        var requiredFilters = [
            ["account", "=", options.account_external_key],
            ["date", ">=", options.start_date],
            ["date", "<=", options.end_date],
            ["mpx_mode", "=", options.mpx_mode]
        ].map(_.splat(dFilter));
        options = {
            dataServiceUrl: options.data_service_url,
            dataServiceKey: options.data_service_key,
            dataPath: options.data_path,
            query: mori.js_to_clj({
                metrics: [],
                filters: requiredFilters,
                aggregations: []
            })
        };
        return new Query(options)
    }
});
(function(Backbone) {
    Backbone.UploadManager = Backbone.View.extend({
        defaults: {
            uploadUrl: "/upload",
            autoUpload: true
        },
        file_id: 0,
        className: "upload-manager",
        initialize: function() {
            this.options = $.extend(this.defaults, this.options);
            this.files = new Backbone.UploadManager.FileCollection;
            this.uploadProcess = $('<input class="fileuploadinput" type="file" name="image_upload" multiple="multiple">').fileupload({
                dataType: "json",
                url: this.options.uploadUrl,
                autoUpload: this.options.autoUpload,
                singleFileUploads: true
            });
            this.bindProcessEvents();
            this.bindLocal();
            this.finished = false
        },
        bindLocal: function() {
            var self = this;
            this.on("fileadd", function(file) {
                self.files.add(file);
                self.renderFile(file)
            }).on("fileprogress", function(file, progress) {
                file.progress(progress)
            }).on("filefail", function(file, error) {
                file.fail(error)
            }).on("filedone", function(file, data) {
                file.done(data.result)
            });
            this.files.on("all", this.updateImageListFormField, this)
        },
        renderFile: function(file) {
            var file_view = new Backbone.UploadManager.FileView($.extend(this.options, {
                model: file
            }));
            $(".file-list", this.el).append(file_view.render().el)
        },
        updateImageListFormField: function() {
            var $file_ids = $(".file_ids", this.el);
            var file_ids = {
                files: []
            };
            this.files.each(function(model, index) {
                if (model.get("image_id")) {
                    file_ids["files"].push(model.get("image_id"))
                }
            });
            $file_ids.val(JSON.stringify(file_ids))
        },
        bindProcessEvents: function() {
            var self = this;
            this.uploadProcess.on("fileuploadadd", function(e, data) {
                data.uploadManagerFiles = [];
                $.each(data.files, function(index, file_data) {
                    file_data.id = self.file_id++;
                    var file = new Backbone.UploadManager.File({
                        data: file_data,
                        processor: data
                    });
                    data.uploadManagerFiles.push(file);
                    file.start();
                    self.trigger("fileadd", file)
                })
            }).on("fileuploadprogress", function(e, data) {
                $.each(data.uploadManagerFiles, function(index, file) {
                    self.trigger("fileprogress", file, data)
                })
            }).on("fileuploadfail", function(e, data) {
                $.each(data.uploadManagerFiles, function(index, file) {
                    var error = "Unknown error";
                    if (typeof data.errorThrown == "string") {
                        error = data.errorThrown
                    } else if (typeof data.errorThrown == "object") {
                        error = data.errorThrown.message
                    } else if (data.result) {
                        if (data.result.error) {
                            error = data.result.error
                        } else if (data.result.files && data.result.files[index] && data.result.files[index].error) {
                            error = data.result.files[index].error
                        } else {
                            error = "Unknown remote error"
                        }
                    }
                    self.trigger("filefail", file, error)
                })
            }).on("fileuploaddone", function(e, data) {
                $.each(data.uploadManagerFiles, function(index, file) {
                    if (data.result && typeof data.result.errors == "string") {
                        self.trigger("filefail", file, data.result.errors)
                    } else {
                        self.trigger("filedone", file, data)
                    }
                })
            })
        },
        render: function() {
            $(this.el).html(JST["nativeads/upload_manager"]());
            this.updateImageListFormField();
            var input = $("input.fileuploadinput", this.el),
                self = this;
            input.on("change", function() {
                self.uploadProcess.fileupload("add", {
                    fileInput: $(this)
                })
            });
            $.each(this.files, function(i, file) {
                self.renderFile(file)
            })
        }
    }, {
        File: Backbone.Model.extend({
            state: "pending",
            start: function() {
                if (this.isPending()) {
                    this.state = "running";
                    this.trigger("filestarted", this)
                }
            },
            cancel: function() {
                this.get("processor").abort();
                this.destroy();
                this.state = "canceled";
                this.trigger("filecanceled", this)
            },
            progress: function(data) {
                this.trigger("fileprogress", this.get("processor").progress())
            },
            fail: function(error) {
                this.state = "error";
                this.trigger("filefailed", error)
            },
            done: function(result) {
                this.state = "done";
                this.set("image_id", result.id);
                this.trigger("filedone", result)
            },
            isPending: function() {
                return this.getState() == "pending"
            },
            isRunning: function() {
                return this.getState() == "running"
            },
            isDone: function() {
                return this.getState() == "done"
            },
            isError: function() {
                return this.getState() == "error" || this.getState == "canceled"
            },
            getState: function() {
                return this.state
            }
        }),
        FileCollection: Backbone.Collection.extend({
            model: this.File
        }),
        FileView: Backbone.View.extend({
            className: "upload-manager-file",
            events: {
                "click .btn-remove": "deleteImage"
            },
            initialize: function() {
                this.model.on("destroy", this.close, this);
                this.model.on("fileprogress", this.updateProgress, this);
                this.model.on("filefailed", this.hasFailed, this);
                this.model.on("filedone", this.hasDone, this);
                this.model.on("all", this.update, this)
            },
            render: function() {
                $(this.el).html(JST["nativeads/uploaded_file_view"](this.computeData()));
                this.update();
                return this
            },
            close: function() {
                this.remove();
                this.off()
            },
            updateProgress: function(progress) {
                var percent = parseInt(progress.loaded / progress.total * 100, 10);
                $("div.progress", this.el).find(".bar").css("width", percent + "%").parent().find(".progress-label").html(this.getTemplateHelpers().displaySize(progress.loaded) + " of " + this.getTemplateHelpers().displaySize(progress.total))
            },
            hasFailed: function(error) {
                $("span.image_upload_message", this.el).html(error)
            },
            hasDone: function(result) {
                $("a.pending", this.el).attr("href", result["url"]).removeClass("pending").addClass("finished");
                $("div.image_upload_size", this.el).html(JST["nativeads/uploaded_file_size"]($.extend(this.getTemplateHelpers(), result)))
            },
            update: function() {
                var when_pending = $("span.size", this.el),
                    when_running = $("div.progress, img.spinner", this.el),
                    when_done = $("span.message, button.btn-remove", this.el);
                if (this.model.isPending()) {
                    when_running.add(when_done).addClass("hidden");
                    when_pending.removeClass("hidden")
                } else if (this.model.isRunning()) {
                    when_pending.add(when_done).addClass("hidden");
                    when_running.removeClass("hidden")
                } else if (this.model.isDone() || this.model.isError()) {
                    when_pending.add(when_running).addClass("hidden");
                    when_done.removeClass("hidden")
                }
                var $link = this.$("a.uploaded_image");
                if ($link.hasClass("pending")) {
                    return
                }
                var $img = $("<img>").attr("src", $link.attr("href"));
                $link.popover({
                    content: $img,
                    html: true,
                    placement: "right",
                    title: $link.attr("href"),
                    trigger: "manual"
                }).on("mouseenter", function() {
                    var self = this;
                    $(this).popover("show");
                    $(this).siblings(".popover").on("mouseleave", function() {
                        $(self).popover("hide")
                    })
                }).on("mouseleave", function() {
                    var self = this;
                    setTimeout(function() {
                        if (!$(".popover:hover").length) {
                            $(self).popover("hide")
                        }
                    }, 200)
                })
            },
            computeData: function() {
                return $.extend(this.getTemplateHelpers(), this.model.get("data"))
            },
            deleteImage: function() {
                var spinner = $(".spinner", this.el);
                spinner.removeClass("hidden");
                var self = this;
                var image_id = this.model.get("image_id");
                if (!image_id) {
                    self.model.destroy();
                    spinner.addClass("hidden")
                } else {
                    $.ajax({
                        type: "DELETE",
                        url: "/advertise/creatives/images/" + this.model.get("image_id")
                    }).done(function(data) {
                        if (data.success) {
                            self.model.destroy()
                        }
                    }).always(function(data) {
                        spinner.addClass("hidden")
                    })
                }
            },
            getTemplateHelpers: function() {
                return {
                    displaySize: function(bytes) {
                        var sizes = ["B", "KB", "MB", "GB", "TB"];
                        if (bytes == 0) return "0 B";
                        var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
                        return (bytes / Math.pow(1024, i)).toFixed(2) + " " + sizes[i]
                    },
                    displayDate: function(timestamp) {
                        return new Date(timestamp).toLocaleString()
                    }
                }
            }
        })
    })
})(Backbone);
momodule("mopub.utilities.rewardedVideoCurrency", function(exports) {
    var setDisabledRewardedCurrencyModalButtons = function(currencyKey, disabled) {
        $("#rewarded-video-currency-cancel" + currencyKey).prop("disabled", disabled);
        $("#rewarded-video-currency-delete" + currencyKey).prop("disabled", disabled);
        $("#rewarded-video-currency-submit" + currencyKey).prop("disabled", disabled)
    };
    exports.setDisabledRewardedCurrencyModalButtons = setDisabledRewardedCurrencyModalButtons;
    exports.setupSaveRewardedCurrency = function(currencyKey, onSuccess) {
        $("#rewarded-video-currency-submit" + currencyKey).click(function() {
            $("#rewarded-video-currency-help" + currencyKey).text("");
            $("#rewarded-video-currency-control-group" + currencyKey).removeClass("error");
            setDisabledRewardedCurrencyModalButtons(currencyKey, true);
            var newName = $("#rewarded-video-currency-input" + currencyKey).val().trim();
            var currencyKeyUri = "";
            if (currencyKey.length) {
                currencyKeyUri = currencyKey + "/"
            }
            $.ajax({
                url: "/account/api/rewarded_video_currency/" + currencyKeyUri,
                type: "POST",
                contentType: "application/json",
                data: JSON.stringify({
                    name: newName
                })
            }).done(function() {
                onSuccess()
            }).fail(function() {
                $("#rewarded-video-currency-help" + currencyKey).text("Required. Must be unique.");
                $("#rewarded-video-currency-control-group" + currencyKey).addClass("error");
                setDisabledRewardedCurrencyModalButtons(currencyKey, false)
            })
        })
    }
});
momodule("mopub.services.budgets", function(exports) {
    var MAX_AG_PER_REQUEST = 128;
    var chunk = function(arr) {
        return mori.partition(MAX_AG_PER_REQUEST, MAX_AG_PER_REQUEST, null, arr)
    };
    _.extend(exports, {
        budgetData: function(adgroupKeys) {
            var grouped = mori.clj_to_js(chunk(adgroupKeys));
            var collector = grouped.length > 1 ? function() {
                return _.flatten(_.map(arguments, _.first))
            } : function() {
                return _.flatten(_.first(arguments))
            };
            return Future.collect(grouped.map(function(keys) {
                return $.ajax({
                    url: "/api/budget/",
                    data: {
                        agExtKeys: keys
                    },
                    timeout: 1e4,
                    type: "POST"
                })
            })).map(collector).rescue(function() {
                return $.Deferred().resolve([])
            })
        }
    })
});
momodule("mopub.services.creatives", function(exports) {
    _.extend(exports, {
        stats_for_adgroup: function(adgroup_external_key, start_date, range) {
            var url = "/api/creatives/adgroup/";
            var convertStartDate = function(start_date) {
                return start_date.getMonth() + 1 + "/" + start_date.getDate() + "/" + start_date.getFullYear()
            };
            return Future.rescue($.ajax({
                url: url,
                data: {
                    adgroup_external_key: adgroup_external_key,
                    r: range,
                    s: convertStartDate(start_date)
                },
                timeout: 5e3
            }), function() {
                return $.Deferred().resolve([])
            })
        }
    })
});
momodule("mopub.services.frontend", function(exports) {
    exports.mpx_adunits = function() {
        return $.ajax({
            url: "/api/mpx_adunits/"
        })
    }
});
momodule("mopub.models.mixins", function(exports) {
    "use strict;";
    exports.CollectionDataManagement = {
        applyData: function(dataServiceResults, modelMatchingKey, dataMatchingKey) {
            var data = mopub.DataServiceUtils.associate_and_extract_with_estimates(dataServiceResults);
            var that = this;
            that.each(function(model) {
                var matchingObj = _.find(data, function(dataObj) {
                    return dataObj[dataMatchingKey] === model.get(modelMatchingKey)
                });
                if (matchingObj) {
                    model.set(matchingObj)
                } else {
                    if (model.resetStats) {
                        model.resetStats()
                    }
                }
            })
        }
    };
    exports.SaveAndErrorTrackingModel = {
        save: function() {
            this.set("model_saving", true);
            this.set("model_errors", {});
            return Backbone.Model.prototype.save.apply(this, arguments).always(function() {
                this.set("model_saving", false)
            }.bind(this)).fail(this._saveFail.bind(this))
        },
        _saveFail: function(xhr) {
            try {
                var resp_dict = JSON.parse(xhr.responseText);
                if (!resp_dict["errors"]) throw "Error response without any errors.";
                this.set("model_errors", _.clone(resp_dict["errors"]))
            } catch (err) {
                this.set("model_errors", {
                    global: ["Error: " + xhr.statusText]
                })
            }
        }
    }
});
momodule("mopub.models.accounts", function(exports) {
    var SaveAndErrorTrackingModel = morequire("mopub.models.mixins.SaveAndErrorTrackingModel");
    exports.PrimaryAdminSettingsModel = Backbone.Model.extend({
        defaults: {
            primary_admin: "",
            available_admins: []
        },
        url: function() {
            return "/account/payments/info/api/primary_admin"
        }
    });
    _.extend(exports.PrimaryAdminSettingsModel.prototype, SaveAndErrorTrackingModel);
    exports.PaymentInfoSettingsModel = Backbone.Model.extend({
        defaults: {
            changes_authorized: false,
            account_number_type: "default",
            bank_name: "",
            bank_address: "",
            bank_country: "",
            country: "",
            beneficiary_name: "",
            payment_preference: "",
            paypal_email: "",
            business_name: "",
            us_tax_id: "",
            local_tax_id: "",
            account_number: "",
            iban: "",
            ach_routing_number: "",
            bank_swift_code: "",
            bank_number: "",
            branch_number: "",
            tos_accepted: false,
            us_tax_id_display: "",
            local_tax_id_display: "",
            paypal_email_display: "",
            account_number_display: "",
            iban_display: "",
            ach_routing_number_display: "",
            bank_swift_code_display: "",
            ISO_COUNTRIES: [],
            BANK_COUNTRIES: [],
            ACCOUNT_TYPES: [],
            PAYMENT_INFO_REGIONS: {}
        },
        url: function() {
            return "/account/payments/info/api/payment_info"
        },
        isNew: function() {
            return false
        }
    });
    _.extend(exports.PaymentInfoSettingsModel.prototype, SaveAndErrorTrackingModel);
    var RewardedVideoCurrency = Backbone.Model.extend();
    exports.RewardedVideoCurrencyCollection = Backbone.Collection.extend({
        url: "/account/api/rewarded_video_currency/",
        model: RewardedVideoCurrency
    })
});
(function($, Backbone, _) {
    var AccountRollUp = Backbone.Model.extend({
        defaults: {
            revenue: 0,
            attempts: 0,
            impressions: 0,
            cpm: 0,
            fill_rate: 0,
            clicks: 0,
            cpc: 0,
            ctr: 0
        },
        url: function() {
            return "/api/ad_network/account_roll_up/"
        }
    });
    var DailyStatsCollection = Backbone.Collection.extend({
        model: AppOnNetwork,
        get_daily_stats: function(stat) {
            return _.map(this.models, function(model) {
                return model.get(stat)
            })
        },
        url: function() {
            return "/api/ad_network/daily_stats/"
        }
    });
    var RollUp = Backbone.Model.extend({
        defaults: {
            revenue: 0,
            attempts: 0,
            impressions: 0,
            cpm: 0,
            fill_rate: 0,
            clicks: 0,
            cpc: 0,
            ctr: 0
        },
        url: function() {
            return "/api/ad_network/roll_up/" + this.get("type") + "/id/" + this.id
        }
    });
    var AppOnNetwork = Backbone.Model.extend({
        defaults: {
            name: "",
            revenue: 0,
            attempts: 0,
            impressions: 0,
            cpm: 0,
            fill_rate: 0,
            clicks: 0,
            cpc: 0,
            ctr: 0
        },
        url: function() {
            return "/api/ad_network/app_on_network/" + this.get("network") + "/pub_id/" + this.id
        }
    });
    var AppOnNetworkCollection = Backbone.Collection.extend({
        model: AppOnNetwork
    });
    window.AccountRollUp = AccountRollUp;
    window.DailyStatsCollection = DailyStatsCollection;
    window.RollUp = RollUp;
    window.AppOnNetwork = AppOnNetwork;
    window.AppOnNetworkCollection = AppOnNetworkCollection
})(this.jQuery, this.Backbone, this._);
var mopub = mopub || {};
(function($, Backbone, _) {
    "use strict";
    var getUrl = function(object) {
        if (!(object && object.url)) return null;
        return _.isFunction(object.url) ? object.url() : object.url
    };

    function UrlError(message) {
        this.name = "UrlError";
        this.message = message || ""
    }
    UrlError.prototype = Error.prototype;

    function StatsError(message) {
        this.name = "StatsError";
        this.message = message || ""
    }
    StatsError.prototype = Error.prototype;

    function calculate_ctr(imp, clk) {
        if (imp === null || clk === null || imp === undefined || clk === undefined) {
            return null
        }
        return imp === 0 ? 0 : clk / imp
    }

    function calculate_fill_rate(req, imp) {
        if (req === null || imp === null || req === undefined || imp === undefined) {
            return null
        }
        return req === 0 ? 0 : imp / req
    }

    function calculate_cpm(imp, rev) {
        if (imp === null || rev === null || imp === undefined || rev === undefined) {
            return null
        }
        return imp === 0 ? 0 : rev / imp * 1e3
    }

    function calculate_conv_rate(conv, clk) {
        if (conv === null || clk === null || conv === undefined || clk === undefined) {
            return null
        }
        return clk === 0 ? 0 : conv / clk
    }

    function format_stat(stat, value) {
        if (value === null || value === undefined) {
            return "--"
        }
        switch (stat) {
            case "att":
            case "clk":
            case "conv":
            case "goal":
            case "imp":
            case "imp":
            case "req":
            case "att":
                return mopub.Utils.formatNumberWithCommas(value);
            case "cpm":
            case "rev":
                return "$" + mopub.Utils.formatNumberWithCommas(value.toFixed(2));
            case "conv_rate":
            case "ctr":
            case "fill_rate":
                return mopub.Utils.formatNumberAsPercentage(value);
            case "status":
                return value;
            case "pace":
                value = value * 100;
                if (value > 250) {
                    return ">250%"
                }
                return value.toFixed() + "%";
            default:
                throw 'Unsupported stat "' + stat + '".'
        }
    }
    var StatsMixin = {
        get_stat: function(stat) {
            switch (stat) {
                case "ctr":
                    return calculate_ctr(this.get_stat("imp"), this.get_stat("clk"));
                case "fill_rate":
                    return calculate_fill_rate(this.get_stat("req"), this.get_stat("imp"));
                case "cpm":
                    return this.get(stat) || calculate_cpm(this.get_stat("imp"), this.get_stat("rev"));
                case "conv_rate":
                    return this.get(stat) || calculate_conv_rate(this.get_stat("conv"), this.get_stat("clk"));
                case "clk":
                case "conv":
                case "imp":
                case "req":
                case "att":
                case "rev":
                    var stat_val = this.get("sum")[stat];
                    if (stat_val) {
                        return stat_val
                    } else {
                        return 0
                    }
                default:
                    throw 'Unsupported stat "' + stat + '".'
            }
        },
        get_formatted_stat: function(stat) {
            return format_stat(stat, this.get_stat(stat))
        },
        get_stat_sum: function(stat) {
            var these_models = this.models;
            if (stat === "ctr") {
                var imp_sum = these_models.reduce(function(memo, model) {
                    return memo + model.get_stat("imp")
                }, 0);
                var clk_sum = these_models.reduce(function(memo, model) {
                    return memo + model.get_stat("clk")
                }, 0);
                var total_ctr = calculate_ctr(imp_sum, clk_sum);
                return total_ctr
            } else if (stat === "fill_rate") {
                var req_sum = these_models.reduce(function(memo, model) {
                    return memo + model.get_stat("req")
                }, 0);
                var imp_sum = these_models.reduce(function(memo, model) {
                    return memo + model.get_stat("imp")
                }, 0);
                var total_fill_rate = calculate_fill_rate(req_sum, imp_sum);
                return total_fill_rate
            } else if (stat === "conv_rate") {
                var conv_sum = these_models.reduce(function(memo, model) {
                    return memo + model.get_stat("conv")
                }, 0);
                var clk_sum = these_models.reduce(function(memo, model) {
                    return memo + model.get_stat("clk")
                }, 0);
                var total_conv_rate = calculate_conv_rate(conv_sum, clk_sum);
                return total_conv_rate
            } else if (stat === "cpm") {
                var imp_sum = these_models.reduce(function(memo, model) {
                    return memo + model.get_stat("imp")
                }, 0);
                var rev_sum = these_models.reduce(function(memo, model) {
                    return memo + model.get_stat("rev")
                }, 0);
                var total_cpm = calculate_cpm(imp_sum, rev_sum);
                return total_cpm
            } else {
                var sum = these_models.reduce(function(memo, model) {
                    return memo + model.get_stat(stat)
                }, 0);
                return sum
            }
        },
        get_formatted_stat_sum: function(stat) {
            var derivative_stats = ["ctr", "fill_rate", "conv_rate", "cpm"],
                stat_value = this.get_stat_sum(stat);
            return _.indexOf(derivative_stats, stat) >= 0 ? format_stat(stat, stat_value) : this.format_revenue(stat, Formatting.format_kmbt(stat_value, 2))
        },
        format_revenue: function(stat, value) {
            if (stat === "rev") {
                value = "$" + value
            }
            return value
        },
        format_awesome: function(thing) {
            return thing
        },
        get_formatted_daily_stats: function() {
            return _.map(this.get("daily_stats"), function(day) {
                day.fill_rate = calculate_fill_rate(day.req, day.imp);
                day.ctr = calculate_ctr(day.imp, day.clk);
                day.cpm = calculate_cpm(day.imp, day.rev);
                day.conv = day.conv || 0;
                day.conv_rate = calculate_conv_rate(day.conv, day.clk);
                _.each(_.keys(day), function(key) {
                    if (key !== "date") {
                        day[key] = format_stat(key, day[key])
                    } else {
                        day[key] = moment(day[key], "YYYY-MM-DD").format("dddd, MMM D, YYYY")
                    }
                });
                return day
            })
        },
        get_full_stat_series: function(stat) {
            if (stat === "ctr") {
                var imp_series = this.get_full_stat_series("imp");
                var clk_series = this.get_full_stat_series("clk");
                var ctr_series = [];
                _.each(_.zip(imp_series, clk_series), function(pair) {
                    ctr_series.push(calculate_ctr(pair[0], pair[1]))
                });
                return ctr_series
            } else if (stat === "cpm") {
                var imp_series = this.get_full_stat_series("imp");
                var rev_series = this.get_full_stat_series("rev");
                var cpm_series = [];
                _.each(_.zip(imp_series, rev_series), function(pair) {
                    cpm_series.push(calculate_cpm(pair[0], pair[1]))
                });
                return cpm_series
            } else if (stat === "fill_rate") {
                var req_series = this.get_full_stat_series("req");
                var imp_series = this.get_full_stat_series("imp");
                var fill_rate_series = [];
                _.each(_.zip(req_series, imp_series), function(pair) {
                    fill_rate_series.push(calculate_fill_rate(pair[0], pair[1]))
                });
                return fill_rate_series
            } else {
                var dailies_for_stat = this.map(function(model) {
                    var daily_stats = model.get("daily_stats");
                    return _.map(daily_stats, function(day) {
                        return day[stat]
                    })
                });
                var memo = [];
                _.times(_.max(_.map(dailies_for_stat, function(m) {
                    return m.length
                })), function(t) {
                    memo.push(0)
                });
                var full_series = _.reduce(dailies_for_stat, function(memo, day_stats) {
                    _.times(memo.length, function(iter) {
                        memo[iter] += day_stats[iter] || 0
                    });
                    return memo
                }, memo);
                return full_series
            }
        },
        get_date_range: function() {
            return _.map(_.union.apply(null, _.map(this.models, function(m) {
                return _.pluck(m.get("daily_stats"), "date")
            })), function(date_str) {
                return moment(date_str).unix()
            })
        },
        parse: function(response) {
            if (response.hasOwnProperty("sum")) {
                if (response.sum.hasOwnProperty("req") && response.sum.req !== null && !response.sum.hasOwnProperty("att")) {
                    response.sum.att = response.sum.req
                } else if (response.sum.hasOwnProperty("att") && response.sum.att !== null && !response.sum.hasOwnProperty("req")) {
                    response.sum.req = response.sum.att
                }
            } else {
                if (response.hasOwnProperty("req") && response.req !== null && !response.hasOwnProperty("att")) {
                    response.att = response.req
                } else if (response.hasOwnProperty("att") && response.att !== null && !response.hasOwnProperty("req")) {
                    response.req = response.att
                }
            }
            _.each(["adunits", "adgroups"], function(subtype) {
                if (response.hasOwnProperty(subtype)) {
                    for (var index in response[subtype]) {
                        var object = response[subtype][index];
                        if (object.hasOwnProperty("sum")) {
                            if (object.sum.hasOwnProperty("req") && object.sum.req !== null && !object.sum.hasOwnProperty("att")) {
                                object.sum.att = object.sum.req
                            } else if (object.sum.hasOwnProperty("att") && object.sum.att !== null && !object.sum.hasOwnProperty("req")) {
                                object.sum.req = object.sum.att
                            }
                        } else {
                            if (object.hasOwnProperty("req") && object.req !== null && !object.hasOwnProperty("att")) {
                                object.att = object.req
                            } else if (object.hasOwnProperty("att") && object.att !== null && !object.hasOwnProperty("req")) {
                                object.req = object.att
                            }
                        }
                    }
                }
            });
            return response
        }
    };
    var LocalStorageMixin = {
        sync: function(method, model, options) {
            var methodMap = {
                create: "POST",
                update: "PUT",
                delete: "DELETE",
                read: "GET"
            };

            function supports_local_storage() {
                try {
                    return "localStorage" in window && window.localStorage !== null
                } catch (e) {
                    return false
                }
            }
            var type = methodMap[method];
            var params = _.extend({
                type: type,
                dataType: "json"
            }, options);
            if (!params.url) {
                params.url = getUrl(model);
                if (params.url === undefined) {
                    throw new UrlError("Unable to retrieve a valid url from model")
                }
            }
            if (!params.data && model && (method == "create" || method == "update")) {
                params.contentType = "application/json";
                params.data = JSON.stringify(model.toJSON())
            }
            if (Backbone.emulateJSON) {
                params.contentType = "application/x-www-form-urlencoded";
                params.data = params.data ? {
                    model: params.data
                } : {}
            }
            if (Backbone.emulateHTTP) {
                if (type === "PUT" || type === "DELETE") {
                    if (Backbone.emulateJSON) params.data._method = type;
                    params.type = "POST";
                    params.beforeSend = function(xhr) {
                        xhr.setRequestHeader("X-HTTP-Method-Override", type)
                    }
                }
            }
            if (params.type !== "GET" && !Backbone.emulateJSON) {
                params.processData = false
            }
            if (method === "read" && supports_local_storage()) {
                var key = "mopub-cache/" + params.url;
                var val = localStorage.getItem(key);
                var success_function = params.success;
                if (val) {
                    _.defer(function() {
                        success_function(JSON.parse(val), "success")
                    })
                }
                params.success = function(resp, status, xhr) {
                    success_function(resp, status, xhr);
                    localStorage.removeItem(key);
                    localStorage.setItem(key, xhr.responseText)
                }
            } else if (method === "update" || method === "delete") {
                var invalidations = model.invalidations() || [params.url];
                _.each(invalidations, function(invalidation_key) {
                    var key = "mopub-cache/" + invalidation_key;
                    localStorage.removeItem(key)
                })
            }
            return $.ajax(params)
        }
    };
    var ModelHelpers = {
        calculate_cpm: calculate_cpm,
        calculate_ctr: calculate_ctr,
        calculate_fill_rate: calculate_fill_rate,
        calculate_conv_rate: calculate_conv_rate,
        format_stat: format_stat
    };
    var App = Backbone.Model.extend({
        defaults: {
            campaign: null,
            adgroup: null,
            include_daily: false,
            include_adunits: false,
            start_date: null,
            date_range: null,
            endpoint: "all",
            imp: 0,
            clk: 0,
            conv: 0,
            req: 0,
            ctr: 0,
            fill_rate: 0
        },
        url: function() {
            var url = "/api/app/" + this.id + "?";
            var campaign = this.get("campaign");
            if (campaign) {
                url += "&campaign=" + campaign
            } else {
                var adgroup = this.get("adgroup");
                if (adgroup) {
                    url += "&adgroup=" + adgroup
                }
            }
            url += "&daily=" + (this.get("include_daily") ? "1" : "0");
            url += "&adunits=" + (this.get("include_adunits") ? "1" : "0");
            var start_date = this.get("start_date");
            if (start_date) {
                url += "&s=" + (start_date.getMonth() + 1) + "/" + start_date.getDate() + "/" + start_date.getFullYear()
            }
            var date_range = this.get("date_range");
            if (date_range) {
                url += "&r=" + date_range
            }
            url += "&endpoint=" + this.get("endpoint");
            return url
        }
    });
    _.extend(App.prototype, StatsMixin);
    var AppCollection = Backbone.Collection.extend({
        model: App
    });
    _.extend(AppCollection.prototype, StatsMixin);
    var AdUnit = Backbone.Model.extend({
        defaults: {
            campaign: null,
            adgroup: null,
            include_daily: false,
            start_date: null,
            date_range: null,
            endpoint: "all",
            req: 0,
            imp: 0,
            fill_rate: 0,
            clk: 0,
            ctr: 0,
            conv: 0
        },
        validate: function(attributes) {
            if (typeof attributes.price_floor !== "undefined") {
                var valid_number = Number(attributes.price_floor);
                if (isNaN(valid_number)) {
                    return "Please enter a valid number for the price floor"
                } else if (valid_number < .01) {
                    return "Please enter a positive number for the price floor"
                } else {}
            }
            if (typeof attributes.soft_price_floor !== "undefined") {
                var valid_number = Number(attributes.soft_price_floor);
                if (isNaN(valid_number)) {
                    return "Please enter a valid number for the price floor"
                } else if (valid_number < 0) {
                    return "Please enter a positive number for the price floor"
                } else {}
            }
        },
        url: function() {
            var url = "/api/adunit/" + this.id + "?";
            var campaign = this.get("campaign");
            if (campaign) {
                url += "&campaign=" + campaign
            } else {
                var adgroup = this.get("adgroup");
                if (adgroup) {
                    url += "&adgroup=" + adgroup
                }
            }
            url += "&daily=" + (this.get("include_daily") ? "1" : "0");
            var start_date = this.get("start_date");
            if (start_date) {
                url += "&s=" + (start_date.getMonth() + 1) + "/" + start_date.getDate() + "/" + start_date.getFullYear()
            }
            var date_range = this.get("date_range");
            if (date_range) {
                url += "&r=" + date_range
            }
            url += "&endpoint=" + this.get("endpoint");
            return url
        }
    });
    _.extend(AdUnit.prototype, StatsMixin);
    var AdUnitCollection = Backbone.Collection.extend({
        model: AdUnit
    });
    _.extend(AdUnitCollection.prototype, StatsMixin);
    var Campaign = Backbone.Model.extend({
        defaults: {
            app: null,
            adunit: null,
            include_daily: false,
            include_adgroups: false,
            include_creatives: false,
            start_date: null,
            date_range: null,
            endpoint: "all"
        },
        url: function() {
            var url = "/api/campaign/" + this.id + "?";
            var app = this.get("app");
            var date_range = this.get("date_range");
            if (app) {
                url += "&app=" + app
            } else {
                var adunit = this.get("adunit");
                if (adunit) {
                    url += "&adunit=" + adunit
                }
            }
            url += "&daily=" + (this.get("include_daily") ? "1" : "0");
            url += "&adgroups=" + (this.get("include_adgroups") ? "1" : "0");
            url += "&creatives=" + (this.get("include_creatives") ? "1" : "0");
            var start_date = this.get("start_date");
            if (start_date) {
                url += "&s=" + (start_date.getMonth() + 1) + "/" + start_date.getDate() + "/" + start_date.getFullYear()
            }
            var date_range = this.get("date_range");
            if (date_range) {
                url += "&r=" + date_range
            }
            url += "&endpoint=" + this.get("endpoint");
            return url
        }
    });
    _.extend(Campaign.prototype, StatsMixin);
    var CampaignCollection = Backbone.Collection.extend({
        model: Campaign,
        isFullyLoaded: function() {
            return this.reduce(function(memo, campaign) {
                return memo && campaign.has("sum")
            }, true)
        }
    });
    _.extend(CampaignCollection.prototype, StatsMixin);
    var AdGroup = Backbone.Model.extend({
        defaults: {
            app: null,
            adunit: null,
            include_daily: false,
            include_creatives: false,
            start_date: null,
            date_range: null,
            endpoint: "all"
        },
        url: function() {
            var url = "/api/adgroup/" + this.id + "?";
            var app = this.get("app");
            if (app) {
                url += "&app=" + app
            } else {
                var adunit = this.get("adunit");
                if (adunit) {
                    url += "&adunit=" + adunit
                }
            }
            url += "&daily=" + (this.get("include_daily") ? "1" : "0");
            url += "&creatives=" + (this.get("include_creatives") ? "1" : "0");
            var start_date = this.get("start_date");
            if (start_date) {
                url += "&s=" + (start_date.getMonth() + 1) + "/" + start_date.getDate() + "/" + start_date.getFullYear()
            }
            var date_range = this.get("date_range");
            if (date_range) {
                url += "&r=" + date_range
            }
            url += "&endpoint=" + this.get("endpoint");
            return url
        }
    });
    _.extend(AdGroup.prototype, StatsMixin);
    var AdGroupCollection = Backbone.Collection.extend({
        model: AdGroup
    });
    _.extend(AdGroupCollection.prototype, StatsMixin);
    var Creative = Backbone.Model.extend({});
    _.extend(Creative.prototype, StatsMixin);
    var CreativeCollection = Backbone.Collection.extend({
        model: Creative
    });
    _.extend(CreativeCollection.prototype, StatsMixin);
    window.ModelHelpers = ModelHelpers;
    window.App = App;
    window.AppCollection = AppCollection;
    window.AdUnit = AdUnit;
    window.AdUnitCollection = AdUnitCollection;
    window.Campaign = Campaign;
    window.CampaignCollection = CampaignCollection;
    window.AdGroup = AdGroup;
    window.AdGroupCollection = AdGroupCollection;
    window.Creative = Creative;
    window.CreativeCollection = CreativeCollection
})(this.jQuery, this.Backbone, this._);
Stats = function() {
    var DEBUG = ("" + window.location).indexOf("localhost") !== -1;
    var LOCAL_ADSTATS_V2_URL = "http://localhost:8888/stats/v2";
    var ADSTATS_V2_URL = "";
    var LOCAL_MPXSTATS_V2_URL = "";
    var MPXSTATS_V2_URL = "";
    var URL = DEBUG ? LOCAL_ADSTATS_V2_URL : ADSTATS_V2_URL;
    var MPXURL = DEBUG ? LOCAL_MPXSTATS_V2_URL : MPXSTATS_V2_URL;
    $.jsonp.setup({
        callbackParameter: "callback"
    });

    function Stats(options) {
        this.options = options;
        this.update()
    }
    Stats.prototype.update = function(external_key, slice_key) {
        var account_key = this.options.account_key,
            start_date = this.options.start_date,
            end_date = this.options.end_date;
        $.jsonp({
            data: {
                data: JSON.stringify(rollups_and_charts_data)
            },
            success: function(json, textStatus) {},
            url: URL
        });
        this.stats = stats
    };
    Stats.prototype.get = function(external_key, slice_key) {};
    return Stats
}();
$(function() {});
momodule("Filters");
(function() {
    Filters.Filter = Backbone.Model.extend({});
    Filters.FilterCollection = Backbone.Collection.extend({
        model: Filters.Filter
    })
})();
momodule("mopub.models", function(exports) {
    exports.Domain = Backbone.Model.extend({
        url: false,
        defaults: {
            value: ""
        }
    });
    exports.DomainCollection = Backbone.Collection.extend({
        model: exports.Domain,
        url: false,
        insertDomains: function(domainValues) {
            var domains = _.map(domainValues, function(val) {
                return {
                    value: val
                }
            });
            this.add(domains, {
                at: 0
            })
        }
    });
    exports.parseDomains = function(text) {
        var values = text.trim().split(/[\s,]+/);
        return _.compact(values)
    }
});
momodule("mopub.models", function(exports) {
    exports.DateRange = Backbone.Model.extend({
        initialize: function() {
            this.set("endDate", exports.DateRange.momentWithoutTime().subtract("days", 1));
            this.set("startDate", exports.DateRange.momentWithoutTime().subtract("days", 14))
        },
        setDates: function(offsets) {
            _(offsets).each(function(offset, key, offsets) {
                offsets[key] = exports.DateRange.momentWithoutTime().subtract("days", offset)
            }, this);
            this.set(offsets)
        },
        length: function() {
            return this.get("endDate").diff(this.get("startDate"), "days") + 1
        },
        clone: function() {
            var newDateRange = new this.constructor;
            newDateRange.set("startDate", this.get("startDate").clone());
            newDateRange.set("endDate", this.get("endDate").clone());
            return newDateRange
        }
    });
    exports.DateRange.momentWithoutTime = function() {
        return moment.utc(moment().utc().format("YYYY-MM-DDT00:00:00Z"))
    }
});
momodule("mopub.models.networks", function(exports) {
    var CollectionDataManagement = morequire("mopub.models.mixins.CollectionDataManagement");
    var DataManagementMixin = exports.DataManagementMixin = {
        incrementFromDataPoint: function(datapoint) {
            this.set("revenue", this.get("revenue") + datapoint.revenue);
            this.set("attempts", this.get("attempts") + datapoint.attempts);
            this.set("impressions", this.get("impressions") + datapoint.impressions);
            this.set("clicks", this.get("clicks") + datapoint.clicks)
        },
        updateEstimates: function(datapoint) {
            if (!this.has("estimates")) {
                this.set("estimates", datapoint.estimates);
                this.set("estimated_dates", datapoint.estimated_dates)
            }
        },
        updateDerivedValues: function() {
            if (this.get("impressions")) {
                this.set("ecpm", this._cleanIllegalValue(1e3 * this.get("revenue") / this.get("impressions")))
            }
            if (this.get("impressions")) {
                this.set("fill_rate", this._cleanIllegalValue(this.get("impressions") / this.get("attempts")))
            }
            if (this.get("clicks")) {
                this.set("ctr", this._cleanIllegalValue(this.get("clicks") / this.get("impressions")))
            }
        },
        _cleanIllegalValue: function(value) {
            return !isFinite(value) || isNaN(value) ? 0 : value
        },
        clearDataServiceValues: function() {
            this.set({
                revenue: 0,
                impressions: 0,
                attempts: 0,
                ecpm: 0,
                fill_rate: 0,
                ctr: 0,
                clicks: 0
            })
        },
        resetStats: function(statsNames) {
            if (!statsNames) {
                statsNames = ["revenue", "ecpm", "attempts", "impressions", "fill_rate", "clicks", "ctr"]
            }
            _(statsNames).each(function(stat) {
                this.set(stat, this.defaults[stat])
            }, this)
        }
    };
    exports.SortableCollection = {
        comparator: function(a, b) {
            a = a.get([this.sortKey]);
            b = b.get([this.sortKey]);
            if (_.isString(a) && _.isString(b)) {
                a = a.toLowerCase();
                b = b.toLowerCase()
            }
            if (this.sortDir === "desc") {
                return a < b ? 1 : a > b ? -1 : 0
            } else {
                return a < b ? -1 : a > b ? 1 : 0
            }
        },
        sortBy: function(metric, dir) {
            if (metric[0] === "-") {
                metric = metric.slice(1);
                dir = "desc"
            }
            this.sortKey = metric;
            this.sortDir = dir ? dir : "asc";
            this.sort()
        }
    };
    exports.InnerComboCollection = Backbone.Collection.extend({
        _setupListeners: function() {
            this.listenTo(this.collectionA, "reset add remove", this.updateCollections, this);
            this.listenTo(this.collectionB, "reset add remove", this.updateCollections, this)
        },
        initialize: function(models, options) {
            this.collectionA = options.collectionA;
            this.collectionB = options.collectionB;
            this._setupListeners();
            this.updateCollections()
        },
        updateCollections: function() {
            if (this.fetching) {
                return
            }
            var modelsA = this.collectionA.models;
            var modelsB = this.collectionB.models;
            var models = [];
            models = models.concat(modelsA);
            models = models.concat(modelsB);
            this.reset(models)
        },
        applyData: function(response) {
            this.collectionA.applyData(response);
            this.collectionB.applyData(response)
        },
        fetch: function(options) {
            var that = this;
            this.fetching = true;
            var deferred = $.Deferred();
            $.when(that.collectionA.fetch(options), that.collectionB.fetch(options)).then(function() {
                that.fetching = false;
                that.updateCollections();
                deferred.resolve()
            });
            return deferred
        },
        getExportHeaders: function() {
            return this.collectionB.getExportHeaders().concat(this.collectionA.getExportHeaders())
        }
    });
    _.extend(exports.InnerComboCollection.prototype, exports.SortableCollection);
    exports.ComboCollection = function(collectionA, collectionB) {
        return new exports.InnerComboCollection(undefined, {
            collectionA: collectionA,
            collectionB: collectionB
        })
    };
    exports.App = Backbone.Model.extend({
        defaults: {
            revenue: 0,
            ecpm: 0,
            attempts: 0,
            impressions: 0,
            fill_rate: 0,
            clicks: 0,
            ctr: 0
        }
    });
    _.extend(exports.App.prototype, DataManagementMixin);
    exports.AppCollection = Backbone.Collection.extend({
        model: exports.App,
        url: function() {
            var url = "/inventory/api/apps/";
            if (this.network_id) {
                url += "?network=" + this.network_id
            }
            return url
        },
        initialize: function(models, options) {
            if (options && options.network_id) {
                this.network_id = options.network_id
            }
        },
        adunitCount: function() {
            return this.adunits().length
        },
        adunits: function() {
            if (this._adunits) {
                return this._adunits
            }
            var _adunits = new exports.AdUnitCollection;
            this.each(function(app) {
                var app_name = app.get("name");
                _.each(app.get("adunits"), function(adunit) {
                    adunit.app_name = app_name;
                    _adunits.add(adunit)
                })
            });
            this._adunits = _adunits;
            return this._adunits
        },
        applyData: function(response) {
            var dataServiceResult = response.results.by_app;
            CollectionDataManagement.applyData.call(this, dataServiceResult, "external_key", "app")
        },
        getExportHeaders: function() {
            return [{
                attribute: "name",
                display_name: "App"
            }, {
                attribute: "number_of_adunits",
                display_name: "Ad Units"
            }, {
                attribute: "revenue",
                display_name: "Revenue"
            }, {
                attribute: "ecpm",
                display_name: "eCPM"
            }, {
                attribute: "attempts",
                display_name: "Attempts"
            }, {
                attribute: "impressions",
                display_name: "Impressions"
            }, {
                attribute: "fill_rate",
                display_name: "Fill Rate"
            }, {
                attribute: "clicks",
                display_name: "Clicks"
            }, {
                attribute: "ctr",
                display_name: "CTR"
            }]
        }
    });
    _.extend(exports.AppCollection.prototype, exports.SortableCollection);
    exports.AdUnit = Backbone.Model.extend({
        defaults: {
            app_name: "",
            app_type_display: "",
            format_display: "",
            revenue: 0,
            ecpm: 0,
            impressions: 0,
            attempts: 0,
            fill_rate: 0,
            ctr: 0,
            clicks: 0,
            active: false
        }
    });
    _.extend(exports.AdUnit.prototype, exports.DataManagementMixin);
    exports.AdUnitCollection = Backbone.Collection.extend({
        model: exports.AdUnit,
        initialize: function(models, options) {
            if (options) {
                this.segment = options.segment;
                this.network_id = options.network_id
            }
            this.sortKey = "app_name"
        },
        url: function() {
            var url = "/inventory/api/adunits/";
            var params = {};
            if (this.segment) {
                params.segment = this.segment
            }
            if (this.network_id) {
                params.network = this.network_id
            }
            if (this.segment || this.network_id) {
                url += "?" + $.param(params)
            }
            return url
        },
        fetch: function() {
            this.deferred = Backbone.Collection.prototype.fetch.apply(this, arguments);
            return this.deferred
        },
        applyData: function(response) {
            var dataServiceResult = response.results.by_adunit;
            CollectionDataManagement.applyData.call(this, dataServiceResult, "external_key", "adunit")
        },
        getExportHeaders: function() {
            return [{
                attribute: "name",
                display_name: "Ad Unit"
            }, {
                attribute: "app_name",
                display_name: "App"
            }, {
                attribute: "app_type_display",
                display_name: "Platform"
            }, {
                attribute: "format",
                display_name: "Ad Format"
            }, {
                attribute: "revenue",
                display_name: "Revenue"
            }, {
                attribute: "ecpm",
                display_name: "eCPM"
            }, {
                attribute: "attempts",
                display_name: "Attempts"
            }, {
                attribute: "impressions",
                display_name: "Impressions"
            }, {
                attribute: "fill_rate",
                display_name: "Fill Rate"
            }, {
                attribute: "clicks",
                display_name: "Clicks"
            }, {
                attribute: "ctr",
                display_name: "CTR"
            }]
        }
    });
    _.extend(exports.AdUnitCollection.prototype, exports.SortableCollection);
    exports.Segment = Backbone.Model.extend({
        defaults: {
            revenue: 0,
            ecpm: 0,
            attempts: 0,
            impressions: 0,
            clicks: 0,
            ctr: 0,
            priority: 12,
            state: "running",
            is_default: false,
            countries: [],
            network_names: [],
            target_countries: true
        },
        urlRoot: "/networks/v2/api/segment/",
        getInventoryDisplay: function() {
            return _.compact(_.flatten([this.get("platforms"), this.get("apps"), this.get("formats")])).join(", ") || "Everything"
        },
        getGeoDisplay: function() {
            var string;
            var countries = this.get("countries");
            if (!_.isEmpty(countries)) {
                if (this.get("target_countries")) {
                    string = "INCLUDED: "
                } else {
                    string = "NOT INCLUDED: "
                }
                string += countries
            } else {
                string = "No Restrictions"
            }
            return string
        },
        getNetworksDisplay: function() {
            return this.get("networks") || "Use All Networks I've Set Up"
        }
    });
    _.extend(exports.Segment.prototype, exports.DataManagementMixin);
    exports.SegmentCollection = Backbone.Collection.extend({
        model: exports.Segment,
        url: function() {
            var base_url = "/networks/v2/api/segment/";
            if (this.archived) {
                return base_url + "?archived=true"
            } else {
                return base_url
            }
        },
        initialize: function(models, options) {
            this.sortKey = "revenue";
            this.sortDir = "desc";
            this.archived = options && options.archived
        },
        applyData: function(dataServiceResult) {
            var data = mopub.DataServiceUtils.associate_and_extract_with_estimates(dataServiceResult);
            this.each(function(segment) {
                segment.resetStats();
                _.each(segment.get("network_segment_campaign_keys"), function(campaign_key) {
                    var matchingDataRow = _.find(data, function(dataRow) {
                        return dataRow.campaign === campaign_key
                    });
                    if (matchingDataRow) {
                        var datapoint = _.pick(matchingDataRow, "revenue", "ecpm", "clicks", "attempts", "impressions", "estimates", "estimated_dates");
                        segment.incrementFromDataPoint(datapoint);
                        segment.updateEstimates(datapoint)
                    }
                });
                segment.updateDerivedValues()
            })
        },
        getExportHeaders: function() {
            return [{
                attribute: "name",
                display_name: "Segment"
            }, {
                attribute: "adunit_count",
                display_name: "Ad Units"
            }, {
                attribute: "revenue",
                display_name: "Revenue"
            }, {
                attribute: "ecpm",
                display_name: "eCPM"
            }, {
                attribute: "attempts",
                display_name: "Attempts"
            }, {
                attribute: "impressions",
                display_name: "Impressions"
            }, {
                attribute: "clicks",
                display_name: "Clicks"
            }, {
                attribute: "ctr",
                display_name: "CTR"
            }]
        }
    });
    _.extend(exports.SegmentCollection.prototype, exports.SortableCollection);
    exports.NetworkTypeCollection = Backbone.Collection.extend({
        url: "/networks/v2/api/network_types/"
    });
    exports.Network = Backbone.Model.extend({
        defaults: {
            active: true,
            account_network_ids: [],
            _app_network_ids: [],
            adunit_network_ids: [],
            revenue_reporting_fields: [],
            revenue: 0,
            impressions: 0,
            ecpm: 0,
            attempts: 0,
            fill_rate: 0,
            ctr: 0,
            clicks: 0,
            countries: [],
            keywords: [],
            target_countries: true,
            display_name: "",
            _supports_revenue_reporting: false,
            special_instructions: "",
            errorMessage: undefined,
            revenue_reporting_credentials: "",
            auth_type: "standard",
            supports_oauth: false,
            requires_oauth: false,
            oauth_enabled: false
        },
        initialize: function() {
            this.updateDerivedAttributes();
            this.on("change", this.updateDerivedAttributes, this)
        },
        updateDerivedAttributes: function() {
            this.set({
                auth_type: this.requiresOAuthForReporting() ? "oauth" : this.get("auth_type"),
                requires_oauth: this.requiresOAuthForReporting()
            }, {
                silent: true
            })
        },
        getAppIds: function() {
            if (this.isCustom() && !this.supportsRevenueReporting()) {
                return []
            }
            return this.get("_app_network_ids")
        },
        supportsRevenueReporting: function() {
            return !this.isCustom() && this.get("_supports_revenue_reporting") && (this.get("network_type") !== "facebook" || mopub.gargoyle.isSwitchEnabled("facebook_network_reporting"))
        },
        requiresOAuthForReporting: function() {
            return this.get("network_type") === "facebook"
        },
        url: function() {
            return "/networks/v2/api/network/" + this.id + "/"
        },
        image_url: function() {
            return "/public/images/networks/" + this.get("network_type") + "-transparent.png"
        },
        isCustom: function() {
            return this.get("network_type") === "custom_html" || this.get("network_type") === "custom_native"
        },
        resetStats: function() {
            DataManagementMixin.resetStats.call(this)
        }
    });
    _.extend(exports.Network.prototype, exports.DataManagementMixin);
    exports.NetworkCollection = Backbone.Collection.extend({
        model: exports.Network,
        url: "/networks/v2/api/network/",
        getExportHeaders: function() {
            return [{
                attribute: "name",
                display_name: "Network"
            }, {
                attribute: "revenue",
                display_name: "Revenue"
            }, {
                attribute: "ecpm",
                display_name: "eCPM"
            }, {
                attribute: "attempts",
                display_name: "Attempts"
            }, {
                attribute: "impressions",
                display_name: "Impressions"
            }, {
                attribute: "fill_rate",
                display_name: "Fill Rate"
            }, {
                attribute: "clicks",
                display_name: "Clicks"
            }, {
                attribute: "ctr",
                display_name: "CTR"
            }]
        },
        initialize: function() {
            this.sortKey = "revenue";
            this.sortDir = "desc"
        },
        fetch: function() {
            this.deferred = Backbone.Collection.prototype.fetch.apply(this, arguments);
            return this.deferred
        },
        applyData: function(dataServiceResult) {
            var data = mopub.DataServiceUtils.associate_and_extract_with_estimates(dataServiceResult);
            this.each(function(network) {
                network.resetStats();
                var matchingDataRow = _.find(data, function(dataRow) {
                    return dataRow.adsource2 === network.get("data_service_network_name")
                });
                if (matchingDataRow) {
                    var modelData = _.pick(matchingDataRow, "revenue", "ecpm", "clicks", "attempts", "impressions", "fill_rate", "estimates", "estimated_dates");
                    network.set(modelData);
                    network.updateDerivedValues()
                }
            })
        }
    });
    _.extend(exports.NetworkCollection.prototype, exports.SortableCollection);
    exports.NetworkApp = Backbone.Model.extend({
        url: function() {
            return "/networks/v2/api/network/" + this.network_id + "/network-apps/"
        }
    });
    exports.NetworkAppCollection = Backbone.Collection.extend({
        initialize: function(models, options) {
            this.network_id = options.network_id;
            this.options = options
        },
        url: function() {
            return "/networks/v2/api/network/" + this.network_id + "/network-apps/"
        },
        model: exports.NetworkApp
    });
    exports.NetworkAdUnit = Backbone.Model.extend({
        defaults: {
            format_display: ""
        },
        url: function() {
            return "/networks/v2/api/network/" + this.network_id + "/adunits/"
        }
    });
    exports.NetworkAdUnitCollection = Backbone.Collection.extend({
        initialize: function(models, options) {
            this.network_id = options.network_id;
            this.options = options
        },
        url: function() {
            return "/networks/v2/api/network/" + this.network_id + "/adunits/"
        },
        model: exports.NetworkAdUnit
    });
    exports.NetworkSegmentAdUnit = Backbone.Model.extend({
        defaults: {
            revenue: 0,
            impressions: 0,
            clicks: 0,
            ecpm: 0,
            fill_rate: 0,
            attempts: 0,
            ctr: 0,
            estimates: {},
            estimated_dates: {}
        },
        url: function() {
            return "/networks/v2/api/nsau/" + this.get("adgroup_external_key") + "/"
        },
        validate: function(attributes) {
            if (attributes.cpm !== null && attributes.cpm !== "" && attributes.cpm !== undefined) {
                var cpm = Number(attributes.cpm);
                if (isNaN(cpm)) {
                    return "Please enter a valid number for the CPM"
                } else if (cpm < .01) {
                    return "Please enter a positive number for the CPM"
                }
            }
        },
        resetStats: function() {
            var statsNames = _(this.defaults).keys();
            DataManagementMixin.resetStats.call(this, statsNames)
        },
        isServing: function() {
            return _.all([this.get("active"), this.get("network_active"), this.get("cpm"), this.get("has_required_network_ids"), this.collection.segment.get("state") === "running"])
        }
    });
    _.extend(exports.NetworkSegmentAdUnit.prototype, exports.DataManagementMixin);
    exports.NetworkSegmentAdUnitCollection = Backbone.Collection.extend({
        initialize: function(models, options) {
            this.segment = options.segment
        },
        comparator: function(model) {
            return -model.get("cpm")
        },
        fetch: function() {
            this.deferred = Backbone.Collection.prototype.fetch.apply(this, arguments);
            return this.deferred
        },
        url: function() {
            return "/networks/v2/api/segment/" + this.segment.id + "/network_segment_adunits/"
        },
        applyData: function(dataServiceResult, adUnits) {
            CollectionDataManagement.applyData.call(this, dataServiceResult, "adgroup_external_key", "adgroup");
            adUnits.each(function(adUnit) {
                adUnit.updateDerivedValues()
            })
        },
        model: exports.NetworkSegmentAdUnit
    });
    exports.NetworkLineItem = Backbone.Model.extend({
        defaults: {
            revenue: 0,
            ecpm: 0,
            attempts: 0,
            impressions: 0,
            clicks: 0,
            ctr: 0,
            countries: [],
            target_countries: true
        },
        resetStats: function() {
            var statsNames = ["revenue", "impressions", "clicks", "ecpm", "ctr", "attempts"];
            DataManagementMixin.resetStats.call(this, statsNames)
        }
    });
    exports.NetworkLineItemCollection = Backbone.Collection.extend({
        model: exports.NetworkLineItem,
        initialize: function(models, options) {
            this.network_id = options.network_id
        },
        url: function() {
            return "/networks/v2/api/network/" + this.network_id + "/line-items/"
        },
        applyData: function(response) {
            var dataServiceResult = response.results.by_adgroup;
            CollectionDataManagement.applyData.call(this, dataServiceResult, "external_key", "adgroup")
        },
        getExportHeaders: function() {
            return [{
                attribute: "name",
                display_name: "Line Item"
            }, {
                attribute: "order_name",
                display_name: "Order Name"
            }, {
                attribute: "priority",
                display_name: "Priority"
            }, {
                attribute: "start_datetime",
                display_name: "Start"
            }, {
                attribute: "end_datetime",
                display_name: "End"
            }, {
                attribute: "revenue",
                display_name: "Revenue"
            }, {
                attribute: "ecpm",
                display_name: "eCPM"
            }, {
                attribute: "attempts",
                display_name: "Attempts"
            }, {
                attribute: "impressions",
                display_name: "Impressions"
            }, {
                attribute: "clicks",
                display_name: "Clicks"
            }, {
                attribute: "ctr",
                display_name: "CTR"
            }]
        }
    });
    exports.NetworkSegment = Backbone.Model.extend({
        defaults: {
            revenue: 0,
            ecpm: 0,
            attempts: 0,
            impressions: 0,
            clicks: 0,
            ctr: 0,
            priority: 12,
            network_names: []
        },
        resetStats: function() {
            var statsNames = ["revenue", "impressions", "clicks", "ecpm", "ctr", "attempts"];
            DataManagementMixin.resetStats.call(this, statsNames)
        }
    });
    exports.NetworkSegmentCollection = Backbone.Collection.extend({
        model: exports.NetworkSegment,
        initialize: function(models, options) {
            if (options && options.network_id) {
                this.network_id = options.network_id
            }
        },
        url: function() {
            var url;
            if (this.network_name) {
                url = "/networks/v2/api/network_segments/" + this.network_name
            } else {
                url = "/networks/v2/api/network_segments/"
            }
            if (this.network_id) {
                url += "?network_type=" + this.network_id
            }
            return url
        },
        applyData: function(response) {
            var dataServiceResult = response.results.by_campaign;
            CollectionDataManagement.applyData.call(this, dataServiceResult, "campaign_external_key", "campaign")
        },
        getExportHeaders: function() {
            return [{
                attribute: "segment_name",
                display_name: "Line Item"
            }, {
                attribute: "created_at",
                display_name: "Start"
            }, {
                attribute: "revenue",
                display_name: "Revenue"
            }, {
                attribute: "ecpm",
                display_name: "eCPM"
            }, {
                attribute: "attempts",
                display_name: "Attempts"
            }, {
                attribute: "impressions",
                display_name: "Impressions"
            }, {
                attribute: "clicks",
                display_name: "Clicks"
            }, {
                attribute: "ctr",
                display_name: "CTR"
            }]
        }
    })
});
momodule("mopub.models.data_shim", function(exports) {
    var utils = morequire("mopub.DataServiceUtils");
    var Query = morequire("mopub.utilities.Query");
    var budgetData = morequire("mopub.services.budgets.budgetData");
    var creatives = morequire("mopub.services.creatives");
    var datesBetween = morequire("mopub.Utils.datesBetween");
    var metric_name_transformation = {
        revenue: "rev",
        clicks: "clk",
        impressions: "imp",
        conversions: "conv",
        requests: "req",
        fill_rate: "fill_rate",
        attempts: "attempts",
        ctr: "ctr"
    };
    var transformKeys = function(objList, customMap) {
        var old_to_new_name_hash = _.extend(metric_name_transformation, customMap);
        var transformer = _.partial(_.mapObj, _, function(value, key) {
            return [old_to_new_name_hash[key] || key, value]
        });
        return objList.map(transformer)
    };
    var groupByAndRemove = function(objArray, key) {
        var keyRemover = _.partial(_.omit, _, key);
        return _.mapValues(_.groupBy(objArray, key), function(v) {
            return v.map(keyRemover)
        })
    };
    var takeFirstValue = _.partial(_.mapValues, _, function(v) {
        return v[0]
    });
    var helpers = exports.helpers = {
        transformKeysGroup: function(groupByField, data) {
            if (!data) return null;
            return groupByAndRemove(transformKeys(utils.associate_and_extract_values(data.columns, data.rows)), groupByField)
        },
        transformKeysGroupTakeFirst: function(groupByField, data) {
            if (!data) return null;
            return takeFirstValue(helpers.transformKeysGroup(groupByField, data))
        },
        transformCustomThenGroup: function(groupByField, data_service_aggregate, dataServiceRowToChildMap) {
            if (!data_service_aggregate) return null;
            var METRICS = _.values(metric_name_transformation);
            var dataList = transformKeys(utils.associate_and_extract_values(data_service_aggregate.columns, data_service_aggregate.rows));
            var metricPicker = _.partial(_.pick, _, METRICS);
            var ungroupedData = dataList.map(function(data) {
                return dataServiceRowToChildMap(data, metricPicker(data))
            });
            return _.groupBy(ungroupedData, groupByField)
        }
    };
    var mergeResults = function(primary_data, date_data, child_data, childKey) {
        var keys = _.keys(primary_data);
        return _.object(keys, keys.map(function(key) {
            var combined = {
                sum: primary_data[key]
            };
            if (childKey && child_data) {
                combined[childKey] = child_data[key]
            }
            if (date_data) {
                combined.daily_stats = date_data[key]
            }
            return combined
        }))
    };
    var appMapper = function(response) {
        return mergeResults(helpers.transformKeysGroupTakeFirst("app", response.results.by_app), helpers.transformKeysGroup("app", response.results.by_date_app), helpers.transformCustomThenGroup("app", response.results.by_app_adunit, function(datum, metrics) {
            return {
                id: datum.adunit,
                app: datum.app,
                sum: metrics
            }
        }), "adunits")
    };
    var adunitMapper = function(response) {
        return mergeResults(helpers.transformKeysGroupTakeFirst("adunit", response.results.by_adunit), helpers.transformKeysGroup("adunit", response.results.by_date_adunit))
    };
    var adgroupMapper = function(response) {
        return mergeResults(helpers.transformKeysGroupTakeFirst("adgroup", response.results.by_adgroup), helpers.transformKeysGroup("adgroup", response.results.by_date_adgroup))
    };
    var campaignMapper = function(response) {
        return mergeResults(helpers.transformKeysGroupTakeFirst("campaign", response.results.by_campaign), helpers.transformKeysGroup("campaign", response.results.by_date_campaign), helpers.transformCustomThenGroup("campaign_key", response.results.by_campaign_adgroup, function(datum, metrics) {
            return {
                id: datum.adgroup,
                campaign_key: datum.campaign,
                sum: metrics
            }
        }), "adgroups")
    };
    var defaultSum = _.defaultObject(_.values(metric_name_transformation), 0);
    var backfillers = exports.backfillers = {
        backfillTopLevel: function(parentKeys, childKeyName, dataByParent) {
            var missingTopLevelObjects = _.difference(parentKeys, _.keys(dataByParent));
            var parentStatGenerator = function(parentKey) {
                return _.object([childKeyName, "sum", "id"], [
                    [], defaultSum, parentKey
                ])
            };
            var missingTopLevelObjectData = missingTopLevelObjects.map(parentStatGenerator);
            return _.extend({}, dataByParent, _.object(missingTopLevelObjects, missingTopLevelObjectData))
        },
        backfillLowerLevel: function(parentToChildrenMap, childToParentMap, parentKeyNameOnChild, childKeyNameOnParent, dataByParent) {
            var childStatGenerator = function(key) {
                return _.object([parentKeyNameOnChild, "sum", "id"], [childToParentMap[key], defaultSum, key])
            };
            var missingLowerLevelObjects = _.chain(dataByParent).mapValues(function(value, key) {
                return _.difference(parentToChildrenMap[key], _.map(value[childKeyNameOnParent], _.property("id")))
            }).mapValues(_.partial(_.map, _, childStatGenerator)).value();
            return _.mapValues(dataByParent, function(value, key) {
                var newValue = {};
                newValue[childKeyNameOnParent] = value[childKeyNameOnParent] ? value[childKeyNameOnParent].concat(missingLowerLevelObjects[key]) : [];
                return _.extend({}, value, newValue)
            })
        },
        backfillDates: function(startDate, endDate, dataByParent) {
            var dateRangeStrs = _.map(datesBetween(moment(startDate).toDate(), moment(endDate).toDate()), function(d) {
                return moment(d).format("YYYY-MM-DD")
            });
            _.each(dataByParent, function(value) {
                var datesCovered = _.pluck(value.daily_stats, "date");
                var missingDateData = _.map(_.difference(dateRangeStrs, datesCovered), function(d) {
                    return _.extend({}, defaultSum, {
                        date: d
                    })
                });
                value.daily_stats = _.sortBy((value.daily_stats || []).concat(missingDateData), "date")
            });
            return dataByParent
        }
    };
    exports.DataShim = function(coreDataServiceData) {
        var backfillTopLevel = backfillers.backfillTopLevel;
        var backfillLowerLevel = backfillers.backfillLowerLevel;
        var backfillDatesPartial = _.partial(backfillers.backfillDates, coreDataServiceData.start_date, coreDataServiceData.end_date);
        return {
            get_order_index_shim: function(line_item_mapping) {
                var campaign_mapping = _.invertWithList(line_item_mapping);
                var line_item_keys = _.keys(line_item_mapping);
                var query = Query(coreDataServiceData).metrics("impressions", "clicks", "conversions", "revenue").filters(["adgroup", "in", line_item_keys]).aggregations(["by_campaign_adgroup", ["campaign", "adgroup"], false], ["by_campaign", ["campaign"], false]);
                var budgets_future = Future.map(budgetData(line_item_keys), _.compose(takeFirstValue, _.partial(groupByAndRemove, _, "adgroup_external_key")));
                var data_hash_future = Future.pipe(query.execute(), campaignMapper, _.partial(backfillTopLevel, _.keys(campaign_mapping), "adgroups"), _.partial(backfillLowerLevel, campaign_mapping, line_item_mapping, "campaign_key", "adgroups")).join(budgets_future).map(function(data, budgets) {
                    _.each(data, function(value) {
                        value.adgroups = value.adgroups.map(function(ag) {
                            return _.extend(ag, budgets[ag.id])
                        })
                    });
                    return data
                });
                return {
                    for_campaign: function(campaign_key) {
                        return Future.map(data_hash_future, _.property(campaign_key))
                    }
                }
            },
            get_archive_index: function(line_item_keys, line_item_map) {
                var order_mapping = _.invertWithList(line_item_map);
                var order_keys = _.keys(order_mapping);
                var baseQuery = Query(coreDataServiceData).metrics("impressions", "clicks", "conversions", "revenue");
                var lineItemQuery = baseQuery.filters(["adgroup", "in", line_item_keys]).aggregations(["by_adgroup", ["adgroup"], false]);
                var orderQuery = baseQuery.filters(["campaign", "in", order_keys]).aggregations(["by_campaign", ["campaign"], false]);
                var budgets_future = Future.pipe(budgetData("line_item_keys"), takeFirstValue, _.partial(groupByAndRemove, _, "adgroup_external_key"));
                var adgroup_future = Future.pipe(lineItemQuery.execute(), adgroupMapper, _.partial(backfillTopLevel, line_item_keys, "creatives")).join(budgets_future).map(function(data, budgets) {
                    _.each(data, function(value, key) {
                        _.extend(value, budgets[key])
                    });
                    return data
                });
                var campaign_future = Future.pipe(orderQuery.execute(), campaignMapper, _.partial(backfillTopLevel, _.keys(order_mapping), "adgroups"), _.partial(backfillLowerLevel, order_mapping, line_item_map, "campaign_key", "adgroups"));
                return {
                    for_campaign: function(campaign_key) {
                        return Future.map(campaign_future, _.property(campaign_key))
                    },
                    for_adgroup: function(adgroup_key) {
                        return Future.map(adgroup_future, _.property(adgroup_key))
                    }
                }
            },
            get_app_detail: function(adunit_mapping, line_item_keys, mpx_campaign_key) {
                var app_key = _.values(adunit_mapping)[0];
                var baseQuery = Query(coreDataServiceData).metrics("requests", "impressions", "fill_rate", "clicks", "ctr", "revenue", "conversions").filters(["app", "=", app_key]);
                var query = baseQuery.aggregations(["by_app", ["app"], false], ["by_date_app", ["date", "app"], false], ["by_app_adunit", ["adunit", "app"], false], ["by_adgroup", ["adgroup"], false]);
                var mpxQueryProm = baseQuery.filters(["campaign", "=", mpx_campaign_key]).aggregations(["by_campaign", ["campaign"], false]).execute();
                var line_item_mapping = _.defaultObject(line_item_keys, "");
                var queryProm = query.execute();
                var budgets_future = Future.pipe(budgetData(line_item_keys), _.partial(groupByAndRemove, _, "adgroup_external_key"), takeFirstValue);
                var adgroupData = Future.pipe(queryProm, function(response) {
                    return helpers.transformKeysGroupTakeFirst("adgroup", response.results.by_adgroup)
                }, mergeResults, _.partial(backfillTopLevel, _.keys(line_item_mapping), "creatives")).join(budgets_future).map(function(data, budgets) {
                    _.each(data, function(value, key) {
                        _.extend(value, budgets[key])
                    });
                    return data
                });
                var campaignData = Future.map(mpxQueryProm, function(response) {
                    return helpers.transformKeysGroupTakeFirst("campaign", response.results.by_campaign)
                }).map(_.partial(backfillTopLevel, [mpx_campaign_key], "adgroups")).map(mergeResults);
                var app_mapping = _.invertWithList(adunit_mapping);
                var appData = Future.pipe(queryProm, appMapper, _.partial(backfillTopLevel, _.keys(app_mapping), "adunits"), _.partial(backfillLowerLevel, app_mapping, adunit_mapping, "app_key", "adunits"), backfillDatesPartial);
                return {
                    for_app: function(app_key) {
                        return Future.map(appData, _.property(app_key))
                    },
                    for_campaign: function(campaign_key) {
                        return Future.map(campaignData, _.property(campaign_key))
                    },
                    for_adgroup: function(adgroup_key) {
                        return Future.map(adgroupData, _.property(adgroup_key))
                    }
                }
            },
            get_order_detail: function(line_item_mapping) {
                var campaign_mapping = _.invertWithList(line_item_mapping);
                var line_item_keys = _.keys(line_item_mapping);
                var query = Query(coreDataServiceData).metrics("impressions", "clicks", "conversions", "revenue").filters(["campaign", "=", _.keys(campaign_mapping)[0]]).aggregations(["by_campaign_adgroup", ["campaign", "adgroup"], false], ["by_campaign", ["campaign"], false], ["by_date_campaign", ["date", "campaign"], false]);
                var budgets_future = Future.map(budgetData(line_item_keys), _.compose(takeFirstValue, _.partial(groupByAndRemove, _, "adgroup_external_key")));
                var data_hash_future = Future.pipe(query.execute(), campaignMapper, _.partial(backfillTopLevel, _.keys(campaign_mapping), "adgroups"), _.partial(backfillLowerLevel, campaign_mapping, line_item_mapping, "campaign_key", "adgroups"), backfillDatesPartial).join(budgets_future).map(function(data, budgets) {
                    _.each(data, function(value) {
                        value.adgroups.forEach(function(ag) {
                            _.extend(ag, budgets[ag.id])
                        })
                    });
                    return data
                });
                return {
                    for_campaign: function(campaign_key) {
                        return Future.map(data_hash_future, _.property(campaign_key))
                    }
                }
            },
            get_inventory: function(adunit_mapping) {
                var app_mapping = _.invertWithList(adunit_mapping);
                var query = Query(coreDataServiceData).metrics("impressions", "revenue", "clicks", "requests", "fill_rate", "ctr").aggregations(["by_date_app", ["app", "date"], false], ["by_app", ["app"], false], ["by_app_adunit", ["app", "adunit"], false]);
                var data_hash_future = Future.pipe(query.execute(), appMapper, _.partial(backfillTopLevel, _.keys(app_mapping), "adunits"), _.partial(backfillLowerLevel, app_mapping, adunit_mapping, "app_key", "adunits"), backfillDatesPartial);
                return {
                    for_app: function(app_key) {
                        return Future.map(data_hash_future, _.property(app_key))
                    }
                }
            },
            get_adunit_detail: function(adunit_key, line_item_keys) {
                var query = Query(coreDataServiceData).metrics("impressions", "revenue", "clicks", "requests", "fill_rate", "ctr", "conversions").filters(["adunit", "=", adunit_key]).aggregations(["by_adunit", ["adunit"], false], ["by_date_adunit", ["adunit", "date"], false], ["by_adgroup", ["adgroup"], false], ["by_date_adgroup", ["adgroup", "date"], false]);
                var queryProm = query.execute();
                var line_item_mapping = _.defaultObject(line_item_keys, "");
                var budgets_future = Future.pipe(budgetData(line_item_keys), _.partial(groupByAndRemove, _, "adgroup_external_key"), takeFirstValue);
                var data_hash_future = Future.pipe(queryProm, adgroupMapper, _.partial(backfillTopLevel, _.keys(line_item_mapping), "creatives")).join(budgets_future).map(function(data, budgets) {
                    _.each(data, function(value, key) {
                        _.extend(value, budgets[key])
                    });
                    return data
                });
                var adunit_data = Future.pipe(queryProm, adunitMapper, _.partial(backfillTopLevel, [adunit_key], null), backfillDatesPartial);
                return {
                    for_adgroup: function(adgroup_key) {
                        return Future.map(data_hash_future, _.property(adgroup_key))
                    },
                    for_adunit: function(adunit_key) {
                        return Future.map(adunit_data, _.property(adunit_key))
                    }
                }
            },
            get_line_item_detail: function(adgroup_external_key, adunit_mapping, start_date, range) {
                var app_mapping = _.invertWithList(adunit_mapping);
                var query = Query(coreDataServiceData).metrics("impressions", "revenue", "clicks", "conversions").filters(["adgroup", "=", adgroup_external_key]).aggregations(["by_adgroup", ["adgroup"], false], ["by_date_adgroup", ["date", "adgroup"], false], ["by_date_app", ["date", "app"], false], ["by_app", ["app"], false], ["by_app_adunit", ["app", "adunit"], false]);
                var creative_future = Future(creatives.stats_for_adgroup(adgroup_external_key, start_date, range));
                var budgets_future = budgetData([adgroup_external_key]);
                var query_future = Future(query.execute());
                var adgroup_future = Future.pipe(query_future, adgroupMapper, _.partial(backfillTopLevel, [adgroup_external_key], "creatives"), backfillDatesPartial, _.property(adgroup_external_key)).join(creative_future, budgets_future).map(function(adgroup, creatives, budgets) {
                    return _.extend({}, adgroup, {
                        creatives: creatives[0]
                    }, budgets[0])
                });
                var app_hash_future = query_future.pipe(appMapper, _.partial(backfillTopLevel, _.keys(app_mapping), "adunits"), _.partial(backfillLowerLevel, app_mapping, adunit_mapping, "app_key", "adunits"));
                return {
                    for_app: function(app_key) {
                        return Future.map(app_hash_future, _.property(app_key))
                    },
                    for_adgroup: function() {
                        return adgroup_future
                    }
                }
            },
            get_mpx_line_item_shim: function(adgroup_external_key, adunit_mapping) {
                var app_mapping = _.invertWithList(adunit_mapping);
                var query = Query(coreDataServiceData).metrics("impressions", "revenue", "clicks").filters(["adgroup", "=", adgroup_external_key]).aggregations(["by_date_app", ["date", "app"], false], ["by_app", ["app"], false], ["by_app_adunit", ["app", "adunit"], false]);
                var data_hash_future = Future.pipe(query.execute(), appMapper, _.partial(backfillTopLevel, _.keys(app_mapping), "adunits"), _.partial(backfillLowerLevel, app_mapping, adunit_mapping, "app_key", "adunits"), backfillDatesPartial);
                return {
                    for_app: function(app_key) {
                        return Future.map(data_hash_future, _.property(app_key))
                    }
                }
            },
            get_marketplace: function(mpx_campaign_key, adunit_mapping) {
                var app_mapping = _.invertWithList(adunit_mapping);
                var query = Query(coreDataServiceData).metrics("revenue", "impressions", "ecpm").filters(["campaign", "=", mpx_campaign_key]).aggregations(["by_app", ["app"], false], ["by_date_app", ["app", "date"], false], ["by_app_adunit", ["app", "adunit"], false]);
                var app_stats_future = Future.pipe(query.execute(), appMapper, _.partial(backfillTopLevel, _.keys(app_mapping), "adunits"), _.partial(backfillLowerLevel, app_mapping, adunit_mapping, "app_key", "adunits"), backfillDatesPartial);
                var frontend_future = mopub.services.frontend.mpx_adunits();
                var app_hash_future = Future.join(app_stats_future, frontend_future).map(function(stats, frontend) {
                    _.each(frontend[0], function(au_dict) {
                        var app = adunit_mapping[au_dict.id];
                        if (app) {
                            _.extend(_.findWhere(stats[app].adunits, {
                                id: au_dict.id
                            }), au_dict)
                        }
                    });
                    return stats
                });
                return {
                    for_app: function(app_key) {
                        return Future.map(app_hash_future, _.property(app_key))
                    }
                }
            }
        }
    }
});
momodule("mopub.models.shim_models", function(exports) {
    var baseShimFactory = function(Model, get_fn_name, pageShim) {
        return Model.extend({
            sync: function(method, model, options) {
                if (method !== "read") return Model.prototype.sync.call(this, method, model, options);
                model.trigger("request");
                var xhr = pageShim[get_fn_name](this.id);
                var success = options.success;
                options.success = function(resp) {
                    if (success) success(model, resp, options);
                    model.trigger("sync", model, resp, options)
                };
                var error = options.error;
                options.error = function(xhr) {
                    if (error) error(model, xhr, options);
                    model.trigger("error", model, xhr, options)
                };
                return xhr.then(options.success, options.error)
            }
        })
    };
    exports.shimmedAppModelFactory = _.partial(baseShimFactory, App, "for_app");
    exports.shimmedCampaignModelFactory = _.partial(baseShimFactory, Campaign, "for_campaign");
    exports.shimmedAdGroupModelFactory = _.partial(baseShimFactory, AdGroup, "for_adgroup");
    exports.shimmedAdUnitModelFactory = _.partial(baseShimFactory, AdUnit, "for_adunit")
});
momodule("mopub.models.publisher", function(exports) {
    var CollectionDataManagement = morequire("mopub.models.mixins.CollectionDataManagement");
    var getAllSupportedFormats = function() {
        var supportedFormatsText = $("#supported_formats_data").text();
        var supportedFormats = supportedFormatsText ? JSON.parse(supportedFormatsText) : {
            phone_formats: [{}],
            tablet_formats: [{}]
        };
        return supportedFormats
    };
    var getPhoneFormats = function() {
        var allFormats = this.getAllSupportedFormats();
        return allFormats.phone_formats
    };
    var getTabletFormats = function() {
        var allFormats = this.getAllSupportedFormats();
        return allFormats.tablet_formats
    };
    var getSimplePhoneFormats = function() {
        var phoneFormats = this.getPhoneFormats();
        return _.object(_.pluck(phoneFormats, "class"), _.pluck(phoneFormats, "label"))
    };
    var getSimpleTabletFormats = function() {
        var tabletFormats = this.getTabletFormats();
        return _.object(_.pluck(tabletFormats, "class"), _.pluck(tabletFormats, "label"))
    };
    var APP_CATEGORY_CHOICES = {
        books: "Books",
        business: "Business",
        education: "Education",
        entertainment: "Entertainment",
        finance: "Finance",
        games: "Games",
        healthcare_and_fitness: "Healthcare and Fitness",
        lifestyle: "Lifestyle",
        medical: "Medical",
        music: "Music",
        navigation: "Navigation",
        news: "News",
        photography: "Photography",
        productivity: "Productivity",
        reference: "Reference",
        social_networking: "Social Networking",
        sports: "Sports",
        travel: "Travel",
        utilities: "Utilities",
        weather: "Weather"
    };
    var AdUnit = Backbone.Model.extend({
        url: function() {
            if (this.has("external_key")) {
                return "/inventory/api/adunit/{0}/".format(this.get("external_key"))
            } else {
                return "/inventory/api/adunit/"
            }
        },
        defaults: {
            name: "Banner Ad",
            format: "320x50",
            device_format: "phone",
            description: "",
            refresh_interval: 30,
            custom_width: null,
            custom_height: null,
            landscape: false,
            daily_impression_cap: 0,
            hourly_impression_cap: 0,
            native_positioning_data: {
                fixed: [{
                    position: 1
                }, {
                    position: 4
                }, {
                    position: 7
                }],
                repeating: {
                    interval: 5
                }
            },
            native_video_enabled: false,
            rewarded_video_currency_amount: null,
            rewarded_video_currency: null,
            rewarded_video_callback_url: null
        },
        native_position_interval_default: 5,
        validation: {
            name: {
                required: true
            },
            format: {
                required: true
            },
            device_format: {
                required: true
            },
            refresh_interval: function(value, attr, computed) {
                var interval = parseFloat(computed.refresh_interval);
                if (interval % 1 !== 0 || interval < 10 && interval !== 0) {
                    return "Please enter a valid refresh interval of at least 10 seconds (or 0 for no refresh). Whole numbers only."
                }
            },
            custom_width: {
                required: function(val, attr, computed) {
                    return computed.format === "custom"
                },
                pattern: "number"
            },
            custom_height: {
                required: function(val, attr, computed) {
                    return computed.format === "custom"
                },
                pattern: "number"
            },
            daily_impression_cap: {
                pattern: "number",
                min: 0
            },
            hourly_impression_cap: {
                pattern: "number",
                min: 0
            },
            "native_positioning_data.fixed": [{
                required: function(val, attr, computed) {
                    if (computed.format != "native") {
                        return false
                    }
                    var positioning_data = computed.native_positioning_data;
                    if (_.has(positioning_data, "repeating") && _.has(positioning_data.repeating, "interval")) {
                        return false
                    } else {
                        return true
                    }
                },
                msg: "Fixed positions are required unless a repeating interval is provided"
            }, {
                fn: function(fixed) {
                    if (_.isUndefined(fixed)) {
                        return
                    }
                    var isNumber = function(val) {
                        return /^\d+$/.test(val)
                    };
                    var isALargeNumber = function(val) {
                        return val > 65535
                    };
                    var hasPosition = function(val) {
                        return _.has(val, "position")
                    };
                    if (!_.all(fixed, hasPosition)) {
                        return "Missing a position attribute"
                    }
                    var sections = _.chain(fixed).pluck("section").compact().value(),
                        positions = _.pluck(fixed, "position");
                    if (!_.all(sections, isNumber) || !_.all(positions, isNumber)) {
                        return "All fixed positions must be integer values"
                    }
                    if (_.any(sections, isALargeNumber) || _.any(positions, isALargeNumber)) {
                        return "All fixed positions must be less than 2^16"
                    }
                }
            }],
            "native_positioning_data.repeating.interval": {
                fn: function(val) {
                    if (_.isUndefined(val)) {
                        return
                    }
                    if (!/^\d+$/.test(val) && val.length != 0) {
                        return "Interval must be a number"
                    } else if (val < 2) {
                        return "Interval must be 2 or greater"
                    } else if (val > 65535) {
                        return "Interval must be less than 2^16"
                    }
                }
            }
        },
        getClassName: function() {
            var format = this.get("format");
            var device_format = this.get("device_format");
            var this_devices_formats;
            if (device_format === "phone") {
                this_devices_formats = exports.getPhoneFormats()
            } else {
                this_devices_formats = exports.getTabletFormats()
            }
            var formatProperties = _(this_devices_formats).find(function(type) {
                return type.value === format
            });
            if (!_.isUndefined(formatProperties)) {
                return device_format + "-" + formatProperties["class"]
            }
            return ""
        },
        hasDefaultName: function() {
            var defaultFormats = _.union(_.values(exports.getSimplePhoneFormats()), _.values(exports.getSimpleTabletFormats()));
            return _(defaultFormats.map(function(item) {
                return "{0} Ad".format(item)
            })).contains(this.get("name"))
        }
    });
    _.extend(AdUnit.prototype, Backbone.Validation.mixin);
    var AdUnitCollection = Backbone.Collection.extend({
        url: "/inventory/api/adunits/",
        model: AdUnit
    });
    var App = Backbone.Model.extend({
        url: function() {
            if (this.has("external_key")) {
                return "/inventory/api/app/{0}/".format(this.get("external_key"))
            } else {
                return "/inventory/api/app/"
            }
        },
        defaults: {
            name: "",
            url: "",
            package: "",
            image_serve_url: "",
            app_type: "iphone",
            coppa_blocked: false,
            coppa_acknowledged: false
        },
        validation: {
            name: {
                required: true
            },
            app_type: {
                required: true
            },
            primary_category: {
                required: true
            },
            coppa_acknowledged: {
                required: true
            },
            coppa_blocked: {
                required: true
            },
            url: [{
                required: function(val, attr, computed) {
                    return computed.app_type !== "android"
                },
                msg: "This field is required"
            }, {
                fn: function(url) {
                    return url.match(Backbone.Validation.patterns.url) ? false : "URL is invalid"
                }
            }],
            package: [{
                required: function(val, attr, computed) {
                    return computed.app_type === "android"
                },
                msg: "This field is required"
            }, {
                fn: function(pkg) {
                    return pkg.match(/^\w[\.\w]+$/) ? false : "Android package name must be valid"
                }
            }]
        },
        initialize: function() {
            var adunits = new AdUnitCollection(this.get("adunits"));
            this.set("adunits", adunits)
        }
    });
    _.extend(App.prototype, Backbone.Validation.mixin);
    var AppCollection = Backbone.Collection.extend({
        url: "/inventory/api/apps/",
        model: App
    });
    var AdSource = Backbone.Model.extend({
        defaults: {
            revenue: 0,
            impressions: 0
        }
    });
    _.extend(exports, {
        APP_CATEGORY_CHOICES: APP_CATEGORY_CHOICES,
        getAllSupportedFormats: getAllSupportedFormats.bind(exports),
        getPhoneFormats: getPhoneFormats.bind(exports),
        getTabletFormats: getTabletFormats.bind(exports),
        getSimplePhoneFormats: getSimplePhoneFormats.bind(exports),
        getSimpleTabletFormats: getSimpleTabletFormats.bind(exports),
        App: App,
        AdUnit: AdUnit,
        AdSource: AdSource,
        AppCollection: AppCollection,
        AdUnitCollection: AdUnitCollection
    })
});
momodule("mopub.views.mixins", function(exports) {
    "use strict;";
    exports.SaveAndErrorTrackingView = {
        processErrors: function() {
            var errors = this.model.get("model_errors") || {};
            if (errors.global) {
                if (_.isFunction(this.globalErrorsHandler)) {
                    this.globalErrorsHandler(errors.global)
                } else {
                    var errorString = "{}".format(errors.global.join("<br>"));
                    this.$(".global-errors").removeClass("hidden").html(errorString)
                }
            }
            var fieldErrors = _.omit(errors, "global");
            _.each(fieldErrors, function(errorList, field) {
                if (_.isFunction(this.fieldErrorsHandler)) {
                    this.fieldErrorsHandler(field, errorList)
                } else {
                    var errorString = "{}".format(errorList.join("<br>"));
                    this.$('[name="{}"]'.format(field)).addClass("error").tooltip({
                        title: errorString,
                        container: this.el
                    })
                }
            }, this)
        }
    }
});
(function($, Backbone) {
    var AccountRollUpView = Backbone.View.extend({
        initialize: function() {
            this.model.bind("change", this.render, this)
        },
        render: function() {
            var stats_div = "#dashboard-stats .stats-breakdown";
            var inner = ".stats-breakdown-value .inner";
            $("#stats-breakdown-revenue " + inner, stats_div).text(mopub.Utils.formatCurrency(this.model.get("revenue")));
            $("#stats-breakdown-impressions " + inner, stats_div).text(mopub.Utils.formatNumberWithCommas(this.model.get("impressions")));
            $("#stats-breakdown-clicks " + inner, stats_div).html('<span class="muted unbold">(' + mopub.Utils.formatNumberWithCommas(this.model.get("clicks")) + ")</span> " + mopub.Utils.formatNumberAsPercentage(this.model.get("ctr")));
            return this
        }
    });
    var DailyStatsView = Backbone.View.extend({
        initialize: function() {
            this.collection.bind("reset", this.render, this)
        },
        render: function() {
            models = this.collection.models;
            var daily_stats = models.map(function(model) {
                return model.attributes
            });
            populateGraphWithStats(daily_stats);
            return this
        }
    });
    var RollUpView = Backbone.View.extend({
        initialize: function() {
            this.model.bind("change", this.render, this)
        },
        render: function() {
            if (this.model.get("type") == "network" && this.model.get("sync_date")) {
                $("#" + this.model.id + "-row .network-status span:first").append(this.model.get("sync_date"))
            }
            var mapper_row = $("tr#" + this.model.id + "-row");
            $(".revenue", mapper_row).text(mopub.Utils.formatCurrency(this.model.get("revenue")));
            $(".attempts", mapper_row).text(mopub.Utils.formatNumberWithCommas(this.model.get("attempts")));
            $(".impressions", mapper_row).text(mopub.Utils.formatNumberWithCommas(this.model.get("impressions")));
            $(".cpm", mapper_row).text(mopub.Utils.formatCurrency(this.model.get("cpm")));
            $(".fill-rate", mapper_row).text(mopub.Utils.formatNumberAsPercentage(this.model.get("fill_rate")));
            $(".clicks", mapper_row).text(mopub.Utils.formatNumberWithCommas(this.model.get("clicks")));
            $(".cpc", mapper_row).text(mopub.Utils.formatCurrency(this.model.get("cpc")));
            $(".ctr", mapper_row).text(mopub.Utils.formatNumberAsPercentage(this.model.get("ctr")));
            return this
        }
    });
    var AppOnNetworkView = Backbone.View.extend({
        initialize: function() {
            this.model.bind("change", this.render, this)
        },
        render: function() {
            var context_dict = {
                name: this.model.get("app_name") + "  ",
                network: this.model.get("network_name"),
                key: this.model.get("mapper_key"),
                url: "/ad_network_reports/app_view/" + this.model.get("mapper_key"),
                revenue: mopub.Utils.formatCurrency(this.model.get("revenue")),
                attempts: mopub.Utils.formatNumberWithCommas(this.model.get("attempts")),
                impressions: mopub.Utils.formatNumberWithCommas(this.model.get("impressions")),
                cpm: mopub.Utils.formatCurrency(this.model.get("cpm")),
                fill_rate: mopub.Utils.formatNumberAsPercentage(this.model.get("fill_rate")),
                clicks: mopub.Utils.formatNumberWithCommas(this.model.get("clicks")),
                cpc: mopub.Utils.formatCurrency(this.model.get("cpc")),
                ctr: mopub.Utils.formatNumberAsPercentage(this.model.get("ctr"))
            };
            var network_html = _.template($("#app-on-network-row-template").html())(context_dict);
            $("#app-on-" + this.model.get("network")).append(network_html);
            context_dict["name"] = this.model.get("network_name") + "  ";
            var app_html = _.template($("#app-on-network-row-template").html())(context_dict);
            $("#" + this.model.get("app_key") + "-on-networks").append(app_html);
            $(".details-row").mouseover(function() {
                var key = $(this).attr("id");
                $(".details-" + key).removeClass("hidden")
            });
            $(".details-row").mouseout(function() {
                var key = $(this).attr("id");
                $(".details-" + key).addClass("hidden")
            });
            return this
        }
    });
    window.AccountRollUpView = AccountRollUpView;
    window.DailyStatsView = DailyStatsView;
    window.AppOnNetworkView = AppOnNetworkView;
    window.RollUpView = RollUpView
})(this.jQuery, this.Backbone);
var mopub = window.mopub || {};
(function() {
    "use strict";
    var TooltipMixin = morequire("mopub.mixins.views.TooltipMixin");
    var ATTRIBUTE_LABELS = {
        rev: "Revenue",
        req: "Requests",
        imp: "Impressions",
        clk: "Clicks",
        att: "Attempts",
        cpm: "CPM",
        fill_rate: "Fill Rate",
        ctr: "CTR",
        conv: "Conversions"
    };

    function clone(obj) {
        if (null == obj || "object" != typeof obj) return obj;
        var copy = obj.constructor();
        for (var attr in obj) {
            if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr]
        }
        return copy
    }

    function createDailyStatsChart(kind, datapoints, dates) {
        var element = "#stats-chart";
        $(element).html("");
        if (datapoints[kind].length === 1) {
            datapoints[kind].push(datapoints[kind][0]);
            dates.push(dates[0] + 60 * 60 * 24)
        }
        var graph = new Rickshaw.Graph({
            element: document.querySelector(element),
            width: 750,
            height: 260,
            renderer: "area",
            interpolation: "linear",
            stroke: true,
            padding: {
                top: "0.25"
            },
            series: [{
                data: _.map(datapoints[kind], function(item, iter) {
                    return {
                        x: dates[iter],
                        y: item
                    }
                }),
                stroke: "#147AA6",
                color: "#EBF2F7"
            }]
        });
        graph.renderer.unstack = true;
        graph.render();
        var time = new Rickshaw.Fixtures.MoPubTime;
        var timeUnit = time.unit("days");
        var xaxes = new Rickshaw.Graph.Axis.Time({
            graph: graph
        });
        xaxes.render();
        var yAxis = new Rickshaw.Graph.Axis.Y({
            graph: graph,
            tickFormat: Rickshaw.Fixtures.Number.formatKMBT,
            ticks: 5,
            ticksTreatment: "glow"
        });
        yAxis.render();
        var hoverDetail = new Rickshaw.Graph.MoPubHoverDetail({
            graph: graph,
            xFormatter: function(x, y) {
                return "" + moment.unix(x).format("dddd, MMMM Do") + "<br />" + ModelHelpers.format_stat(kind, y) + " " + ATTRIBUTE_LABELS[kind]
            }
        })
    }
    var CollectionChartView = Backbone.View.extend({
        el: "#stats",
        initialize: function() {
            try {
                this.template = _.template($("#chart-template").html())
            } catch (e) {}
        },
        render: function() {
            var this_view = this;
            var template_values = {
                rev: null,
                req: null,
                imp: null,
                clk: null,
                att: null,
                cpm: null,
                fill_rate: null,
                ctr: null,
                conv: null
            };
            var active_display_value = this_view.options.active_display_value || this_view.options.display_values[0];
            template_values["active"] = active_display_value;
            var series_list = {};
            _.each(this_view.options.display_values, function(display_val) {
                var formatted_sum = this_view.collection.get_formatted_stat_sum(display_val);
                template_values[display_val] = formatted_sum;
                var current_series = this_view.collection.get_full_stat_series(display_val);
                series_list[display_val] = current_series
            });
            $(this_view.el).html(this_view.template(template_values));
            var series_length = series_list[this_view.options.display_values[0]].length;
            var series_dates = this_view.collection.get_date_range();
            $(".topline-numbers .breakdown-container", this_view.el).click(function() {
                $(".topline-numbers .breakdown-container.active", this_view.el).removeClass("active");
                var $this = $(this);
                $this.addClass("active");
                var stats_type = $this.attr("id").replace("stats-breakdown-", "");
                createDailyStatsChart(stats_type, series_list, series_dates)
            });
            createDailyStatsChart(active_display_value, series_list, series_dates)
        }
    });
    var AppView = Backbone.View.extend({
        initialize: function() {
            if (this.options.endpoint_specific) {
                this.model.bind("change", this.render, this)
            }
            try {
                this.template = _.template($("#app-template").html())
            } catch (e) {}
        },
        render: function() {
            if (!this.template) {
                return this.renderInline()
            }
            var renderedContent = $(this.template(this.model.toJSON()));
            $("tbody", this.el).append(renderedContent);
            return this
        },
        renderInline: function() {
            var this_view = this;
            var app_row = $("#app-" + this_view.model.id);
            var metrics = ["cpm", "imp", "clk", "ctr", "fill_rate", "req", "att", "conv", "conv_rate", "rev"];
            _.each(metrics, function(metric) {
                var metric_text = this_view.model.get_formatted_stat(metric);
                $("." + metric, app_row).text(metric_text)
            });
            $(".loading-img", app_row).hide();
            if (this.model.has("adunits")) {
                var adunit_collection = this.model.get("adunit_collection") || new AdUnitCollection;
                this.model.set("adunit_collection", adunit_collection, {
                    silent: true
                });
                adunit_collection.reset();
                var i, adunit, adunit_view;
                var adunits = this.model.get("adunits");
                for (i = 0; i < adunits.length; i++) {
                    adunit = new AdUnit(adunits[i]);
                    adunit_collection.add(adunit);
                    adunit_view = new AdUnitView({
                        model: adunit,
                        el: ".publisher_table"
                    });
                    adunit_view.renderInline()
                }
            }
            return this
        }
    });
    var AdUnitView = Backbone.View.extend({
        initialize: function() {
            try {
                this.template = _.template($("#adunit-template").html())
            } catch (e) {}
        },
        renderInline: function() {
            var current_model = this.model;
            var adunit_row = $("#adunit-" + this.model.id);
            var metrics = ["rev", "cpm", "imp", "clk", "ctr", "fill_rate", "req", "att", "conv", "conv_rate"];
            _.each(metrics, function(metric) {
                var metric_text = current_model.get_formatted_stat(metric);
                $("." + metric, adunit_row).text(metric_text)
            });
            _.each(["price_floor", "soft_price_floor"], function(price_floor_type) {
                var price_floor_html = '<img class="loading-img hidden" ' + 'src="/public/images/spin-small.gif">' + "</img> " + '<input id="' + current_model.id + '" ' + 'type="text" ' + 'class="input-text input-text-number number" ' + 'value="' + current_model.get(price_floor_type) + '"> ';
                $("." + price_floor_type, adunit_row).html(price_floor_html);
                $("." + price_floor_type + " .input-text", adunit_row).keyup(function() {
                    var input_field = $(this);
                    input_field.removeClass("error");
                    var loading_img = $("." + price_floor_type + ".loading-img", adunit_row);
                    loading_img.show();
                    var new_fields = {};
                    new_fields[price_floor_type] = input_field.val();
                    var promise = current_model.save(new_fields);
                    if (promise) {
                        promise.success(function() {
                            loading_img.hide()
                        });
                        promise.error(function() {
                            loading_img.hide()
                        })
                    } else {
                        loading_img.hide();
                        input_field.addClass("error")
                    }
                })
            });
            var targeting_html = '<img class="loading-img hidden" ' + 'src="/public/images/spin-small.gif"></img>' + '<input class="targeting-box" type="checkbox">';
            $(".targeting", adunit_row).html(targeting_html);
            if (current_model.get("active")) {
                $("input.targeting-box", adunit_row).attr("checked", "checked")
            }
            $("input.targeting-box", adunit_row).click(function() {
                var loading_img = $(".targeting .loading-img", adunit_row);
                loading_img.show();
                current_model.save({
                    active: $(this).is(":checked")
                }, {
                    success: function() {
                        setTimeout(function() {
                            loading_img.hide()
                        }, 200)
                    }
                })
            });
            var spf_auto_manage_checkbox = $(".spf_auto_manage input", adunit_row);
            var spf_input = $(".soft_price_floor input", adunit_row);
            spf_auto_manage_checkbox.prop("disabled", false);
            if (current_model.get("spf_auto_manage")) {
                spf_auto_manage_checkbox.prop("checked", true);
                if (!MOPUB_USER_IS_STAFF) {
                    spf_input.prop("disabled", true)
                }
            }
            spf_auto_manage_checkbox.off("change");
            spf_auto_manage_checkbox.change(function(e) {
                var loading_img = $(".spf_auto_manage .loading-img", adunit_row);
                var auto_manage_checked = $(this).prop("checked");
                loading_img.removeClass("hidden");
                current_model.save({
                    spf_auto_manage: auto_manage_checked
                }, {
                    success: function() {
                        setTimeout(function() {
                            loading_img.addClass("hidden")
                        }, 200);
                        if (auto_manage_checked && !MOPUB_USER_IS_STAFF) {
                            spf_input.prop("disabled", true)
                        } else {
                            spf_input.prop("disabled", false)
                        }
                    }
                })
            });
            return this
        }
    });
    var CampaignView = Backbone.View.extend({
        renderInline: function() {
            var model = this.model;
            var $el = $("#" + model.id, this.el);
            var stats = ["rev", "imp", "fill_rate", "clk", "cpm", "ctr", "conv", "conv_rate"];
            _.each(stats, function(stat) {
                $("." + stat, $el).text(model.get_formatted_stat(stat))
            });
            $(".loading-img", $el).hide();
            return this
        }
    });
    var AdGroupView = CampaignView;
    var NetworkGraphView = Backbone.View.extend({
        initialize: function() {
            this.collection.bind("change", this.render, this)
        },
        render: function() {
            var this_view = this;
            if (this_view.collection.isFullyLoaded()) {
                var metrics = ["rev", "imp", "clk", "ctr"];
                var network_campaigns = new CampaignCollection(_.filter(this.collection.models, function(campaign) {
                    return campaign.get("endpoint") == "networks"
                }));
                var mopub_campaigns = new CampaignCollection(_.filter(this.collection.models, function(campaign) {
                    return campaign.get("endpoint") == "all"
                }));
                _.each(metrics, function(metric) {
                    var selector = "#stats-breakdown-" + metric;
                    var mopub_selector, network_selector;
                    if (metric == "rev") {
                        mopub_selector = null;
                        network_selector = selector + " .network-chart-rev"
                    } else {
                        mopub_selector = selector + " .mopub-chart-data";
                        network_selector = selector + " .network-chart-data"
                    }
                    $(mopub_selector).html(mopub_campaigns.get_formatted_stat_sum(metric));
                    $(network_selector).html(network_campaigns.get_formatted_stat_sum(metric))
                });
                if (_.isEmpty(network_campaigns.models)) {
                    mopub.dashboardStatsChartData = {
                        pointStart: this_view.options.start_date,
                        pointInterval: 864e5,
                        imp: [{
                            Total: mopub_campaigns.get_full_stat_series("imp")
                        }],
                        clk: [{
                            Total: mopub_campaigns.get_full_stat_series("clk")
                        }],
                        ctr: [{
                            Total: mopub_campaigns.get_full_stat_series("ctr")
                        }],
                        total: false
                    }
                } else {
                    mopub.dashboardStatsChartData = {
                        pointStart: this_view.options.start_date,
                        pointInterval: 864e5,
                        imp: [{
                            "From MoPub": mopub_campaigns.get_full_stat_series("imp")
                        }, {
                            "From Networks": network_campaigns.get_full_stat_series("imp")
                        }],
                        rev: [{
                            "From Networks": {
                                data: network_campaigns.get_full_stat_series("rev"),
                                color: "#e57300"
                            }
                        }],
                        clk: [{
                            "From MoPub": mopub_campaigns.get_full_stat_series("clk")
                        }, {
                            "From Networks": network_campaigns.get_full_stat_series("clk")
                        }],
                        ctr: [{
                            "From MoPub": mopub_campaigns.get_full_stat_series("ctr")
                        }, {
                            "From Networks": network_campaigns.get_full_stat_series("ctr")
                        }],
                        total: false
                    }
                }
                mopub.Chart.setupDashboardStatsChart("line");
                $("#stats-chart").show()
            }
        }
    });
    var NetworkView = Backbone.View.extend({
        initialize: function() {
            this.model.bind("change", this.render, this)
        },
        render: function() {
            var this_view = this;
            var row = $("tr#" + this_view.model.id + "-row");
            if (this_view.model.get("endpoint") == "networks") {
                var metrics = ["rev", "cpm", "att", "imp", "fill_rate", "clk", "ctr"];
                var selector = " .network-data"
            } else {
                var metrics = ["att", "imp", "fill_rate", "clk", "ctr"];
                var selector = " .mopub-data"
            }
            _.each(metrics, function(metric) {
                var stat = this_view.model.get_stat(metric);
                if ((stat || stat == 0) && (this_view.model.get("endpoint") != "networks" || this_view.model.get("network") != "chartboost" && this_view.model.get("network") != "huntmads" && this_view.model.get("network") != "mobfox" || metric != "att" && metric != "fill_rate")) {
                    $("." + metric + selector, row).text(this_view.model.get_formatted_stat(metric))
                }
            });
            return this
        }
    });
    var NetworkAppView = Backbone.View.extend({
        initialize: function() {
            if (this.options.endpoint_specific) {
                this.model.bind("change", this.render, this)
            }
            try {
                this.template = _.template($("#app-template").html())
            } catch (e) {}
        },
        renderInline: function() {
            var this_view = this;
            var network_id = this_view.options.network_id;
            var app_row = $("#network-" + network_id + "-app-" + this_view.model.id);
            if (this_view.options.endpoint_specific) {
                if (this_view.model.get("endpoint") == "networks") {
                    var metrics = ["rev", "cpm", "att", "imp", "fill_rate", "clk", "ctr"];
                    var selector = " .network-data"
                } else {
                    var metrics = ["att", "imp", "fill_rate", "clk", "ctr"];
                    var selector = " .mopub-data"
                }
            } else {
                var metrics = ["att", "imp", "fill_rate", "clk", "ctr"];
                var selector = ""
            }
            _.each(metrics, function(metric) {
                if (this_view.model.get("endpoint") != "networks" || this_view.options.network != "chartboost" && this_view.options.network != "huntmads" && this_view.options.network != "mobfox" || metric != "att" && metric != "fill_rate") {
                    $("." + metric + selector, app_row).text(this_view.model.get_formatted_stat(metric))
                }
            });
            $(".loading-img", app_row).hide();
            if (this.model.has("adunits")) {
                _.each(this.model.get("adunits"), function(adunit_data) {
                    var adunit = new AdUnit(adunit_data);
                    var adunit_view = new AdUnitView({
                        model: adunit,
                        el: ".publisher_table"
                    });
                    adunit_view.renderInline()
                })
            }
            return this
        },
        render: function() {
            if (!this.template) {
                return this.renderInline()
            }
            var renderedContent = $(this.template(this.model.toJSON()));
            $("tbody", this.el).append(renderedContent);
            return this
        }
    });
    var OrderView = Backbone.View.extend({
        initialize: function() {
            try {
                this.template = _.template($("#campaign-template").html())
            } catch (e) {}
        },
        renderInline: function() {
            var current_model = this.model;
            var order_row = $("#" + current_model.id, this.el);
            var display_fields = ["rev", "imp", "fill_rate", "clk", "ctr", "conv", "conv_rate"];
            _.each(display_fields, function(field) {
                var field_text = current_model.get_formatted_stat(field);
                order_row.find(".{}".format(field)).text(field_text)
            });
            if (current_model.has("adgroups")) {
                order_row.children(".lineitems").text(current_model.get("adgroups").length)
            }
            order_row.find(".loading-img").hide()
        }
    });
    var LineItemView = Backbone.View.extend({
        initialize: function() {
            try {
                this.template = _.template($("#adgroup-template").html())
            } catch (e) {}
        },
        renderInline: function() {
            var current_model = this.model;
            var current_model_key = current_model.id;
            var row = $("#" + current_model_key, this.el);
            var display_fields = ["rev", "imp", "fill_rate", "clk", "cpm", "ctr", "conv", "conv_rate"];
            _.each(display_fields, function(field) {
                row.find(".{}".format(field)).text(current_model.get_formatted_stat(field))
            });
            if (current_model.has("percent_delivered")) {
                var percent_delivered = Math.round(current_model.get("percent_delivered") * 100);
                var $percent_delivered = row.children(".delivery");
                var $progress = $percent_delivered.find(".progress");
                $progress.removeClass("hidden");
                $percent_delivered.find(".bar").css("width", percent_delivered + "%");
                if (percent_delivered > 250) {
                    $percent_delivered.find(".progress-bar-text").text(">250%")
                } else {
                    $percent_delivered.find(".progress-bar-text").text("{}%".format(percent_delivered))
                }
            }
            if (current_model.has("pacing")) {
                var pace = Math.round(current_model.get("pacing") * 100);
                var $pace = row.find(".pace");
                if (pace < 50) {
                    $pace.addClass("pace-failure")
                } else if (pace < 85) {
                    $pace.addClass("pace-warning")
                } else {
                    $pace.addClass("pace-success")
                }
                if (pace > 250) {
                    $pace.text("Pace: >250%")
                } else {
                    $pace.text("Pace: " + pace + "%")
                }
                $pace.show()
            }
            TooltipMixin.createPopover(current_model_key);
            $(".loading-img", row).hide()
        }
    });
    var CreativeView = Backbone.View.extend({
        renderInline: function() {
            var current_model = this.model;
            var creative_row = $("#" + current_model.id, this.el);
            var display_fields = ["rev", "imp", "fill_rate", "clk", "ctr", "conv", "conv_rate"];
            _.each(display_fields, function(field) {
                var field_text = current_model.get_formatted_stat(field);
                $("." + field, creative_row).text(field_text)
            });
            $(".loading-img", creative_row).hide()
        }
    });
    window.CollectionChartView = CollectionChartView;
    window.AdUnitView = AdUnitView;
    window.AppView = AppView;
    window.CampaignView = CampaignView;
    window.AdGroupView = AdGroupView;
    window.OrderView = OrderView;
    window.LineItemView = LineItemView;
    window.CreativeView = CreativeView;
    window.NetworkAppView = NetworkAppView;
    window.NetworkView = NetworkView;
    window.NetworkGraphView = NetworkGraphView
}).call(this);
momodule("Filters");
(function() {
    Filters.OrderFilterGroups = [{
        groupName: "Status",
        options: [{
            display: "Completed",
            value: "completed"
        }, {
            display: "Paused",
            value: "paused"
        }, {
            display: "Running",
            value: "running"
        }, {
            display: "Scheduled",
            value: "scheduled"
        }]
    }];

    function createLineItemFilterGroup(omitPmp) {
        var statusGroup = {
            groupName: "Status",
            options: [{
                display: "Completed",
                value: "completed"
            }, {
                display: "Paused",
                value: "paused"
            }, {
                display: "Running",
                value: "running"
            }, {
                display: "Scheduled",
                value: "scheduled"
            }]
        };
        var typeGroup = {
            groupName: "Type",
            options: [{
                display: "Guaranteed",
                value: "gtee"
            }, {
                display: "Promotional",
                value: "promo"
            }, {
                display: "Network",
                value: "network"
            }, {
                display: "Non-Guaranteed",
                value: "non_gtee"
            }, {
                display: "Mrkt. Line Item",
                value: "mpx_line_item"
            }, {
                display: "Private Marketplace",
                value: "pmp_line_item"
            }, {
                display: "Backfill Promotional",
                value: "backfill_promo"
            }]
        };
        var priorityGroup = {
            groupName: "Priority",
            options: _.map(_.range(1, 17), function(i) {
                return {
                    display: i,
                    value: "p{}".format(i)
                }
            })
        };
        if (omitPmp) {
            typeGroup.options = _.filter(typeGroup.options, function(obj) {
                return obj.value != "pmp_line_item"
            })
        }
        return [statusGroup, typeGroup, priorityGroup]
    }
    Filters.getLineItemFilterGroups = function() {
        var omitPmp = !mopub.gargoyle.isSwitchEnabled("pmp_line_items");
        return createLineItemFilterGroup(omitPmp)
    };
    Filters.AppFilterGroups = [{
        groupName: "Platform",
        options: [{
            display: "Android",
            value: "android"
        }, {
            display: "iOS",
            value: "iphone"
        }, {
            display: "Mobile Web",
            value: "mweb"
        }]
    }];
    Filters.AdUnitFilterGroups = [{
        groupName: "Platform",
        options: [{
            display: "Android",
            value: "android"
        }, {
            display: "iOS",
            value: "iphone"
        }, {
            display: "Mobile Web",
            value: "mweb"
        }]
    }, {
        groupName: "Ad Format",
        options: [{
            display: "Banner (320x50)",
            value: "320x50"
        }, {
            display: "Custom Size",
            value: "custom"
        }, {
            display: "Leaderboard (728x90)",
            value: "728x90"
        }, {
            display: "Medium (300x250)",
            value: "300x250"
        }, {
            display: "Native (Custom Layout)",
            value: "native"
        }, {
            display: "Phone Fullscreen (320x480)",
            value: "full"
        }, {
            display: "Phone Fullscreen Landscape (480x320)",
            value: "full_landscape"
        }, {
            display: "Rewarded Video",
            value: "rewarded_video"
        }, {
            display: "Skyscraper (160x600)",
            value: "160x600"
        }, {
            display: "Tablet Fullscreen (1024x768)",
            value: "full_tablet"
        }, {
            display: "Tablet Fullscreen Landscape (768x1024)",
            value: "full_tablet_landscape"
        }]
    }];
    Filters.FilteredTableView = Backbone.Marionette.Layout.extend({
        regions: {
            filterPanel: ".filter-panel",
            table: ".table"
        },
        initialize: function() {
            this.template = _.template($(this.el).html());
            $(this.el).empty();
            this.filter_groups = this.options.filter_groups
        },
        onRender: function() {
            var filter_panel = new Filters.FilterPanelView;
            var filter_button = new Filters.FilterButtonView({
                el: this.options.button_el,
                filter_panel: filter_panel,
                table_el: this.$(this.table.el),
                filter_groups: this.filter_groups
            });
            filter_button.render();
            this.filterPanel.show(filter_panel)
        }
    });
    Filters.FilterButtonView = Backbone.Marionette.ItemView.extend({
        template: JST.filter_buttons,
        events: {
            "click .filter-toggle": "filter"
        },
        templateHelpers: function() {
            return {
                filter_groups: this.options.filter_groups
            }
        },
        filter: function(e) {
            e.preventDefault();
            var $target = $(e.currentTarget),
                filter_value = $target.data("toggle"),
                filter_type = $target.data("filter-type"),
                filter_display = $target.text().replace(/^\s+|\s+$/g, "");
            this.filter_panel.collection.add(new Filters.Filter({
                id: filter_value,
                filter_type: filter_type,
                filter_display: filter_display,
                filter_value: filter_value
            }))
        },
        recalculateAdUnitTableFilters: function() {
            var passing_adunit_regions = [];
            var table = $(this.options.table_el);
            var adunits = $("td .adunit", table);
            var adunitFilters = this.filter_panel.collection.filter(function(filter_model) {
                return filter_model.get("filter_type") === "Ad Format"
            });
            if (adunitFilters.length === 0) {
                return $("td .adunit", table)
            } else {
                _(adunits).each(function(adunit) {
                    var wrap_adunit = $(adunit);
                    var show_adunit = _.any(adunitFilters, function(f_model) {
                        return wrap_adunit.hasClass(f_model.get("filter_value"))
                    });
                    if (show_adunit) {
                        passing_adunit_regions.push(wrap_adunit)
                    }
                })
            }
            return passing_adunit_regions
        },
        recalculateTableFilters: function() {
            var table = $(this.options.table_el);
            var table_rows = $("tr", table).not("thead tr");
            if (this.filter_panel.collection.length === 0) {
                return _.map(table_rows, function(row) {
                    return $(row)
                })
            } else {
                var grouped = this.filter_panel.collection.groupBy(function(model) {
                    return model.get("filter_type")
                });
                var possible_rows = {};
                _.each(grouped, function(filters, group) {
                    possible_rows[group] = [];
                    _.each(table_rows, function(table_row) {
                        _.each(filters, function(filter) {
                            if ($(table_row).hasClass(filter.get("filter_value"))) {
                                possible_rows[group].push($(table_row).attr("id"))
                            }
                        })
                    })
                });
                return _.map(_.flatten(_.intersection.apply(this, _.values(possible_rows))), function(row_id) {
                    return $("#" + row_id)
                })
            }
        },
        hideTableRows: function() {
            var table = $(this.options.table_el);
            $("tr", table).not("thead tr").hide()
        },
        hideAdUnitRegions: function() {
            var table = $(this.options.table_el);
            $("td .adunit", table).hide()
        },
        show_with_transition: function(element) {
            return $(element).show(1)
        },
        initialize: function() {
            this.filter_panel = this.options.filter_panel;
            this.listenTo(this.filter_panel.collection, "add remove reset", function() {
                var table_position = $("body").scrollTop();
                this.hideTableRows();
                this.hideAdUnitRegions();
                var rows_to_show = this.recalculateTableFilters();
                var adunit_regions_to_show = this.recalculateAdUnitTableFilters();
                _(adunit_regions_to_show).each(this.show_with_transition);
                _(rows_to_show).each(this.show_with_transition);
                _.defer(function() {
                    $("body").scrollTop(table_position)
                })
            }, this)
        }
    });
    Filters.FilterTagView = Backbone.Marionette.ItemView.extend({
        template: JST.filter_tag_view,
        tagName: "button",
        className: "btn btn-mini",
        events: {
            click: "removeSelf"
        },
        removeSelf: function() {
            this.model.collection.remove(this.model)
        }
    });
    Filters.FilterPanelView = Backbone.Marionette.CompositeView.extend({
        template: JST.filter_panel_view,
        itemView: Filters.FilterTagView,
        itemViewContainer: ".filter-tags",
        className: "hidden",
        events: {
            "click .filter-panel-clear": "clear"
        },
        initialize: function() {
            this.collection = new Filters.FilterCollection;
            this.listenTo(this.collection, "add remove reset", this.toggleVisibility, this)
        },
        clear: function() {
            this.collection.reset([])
        },
        toggleVisibility: function() {
            if (this.collection.length == 0) {
                this.$el.hide()
            } else {
                this.$el.show()
            }
        }
    })
})();
momodule("mopub.views.components", function(exports) {
    exports.EducationModuleView = Backbone.View.extend({
        template: JST["components/education"],
        render: function() {
            this.$el.html(this.template({
                header: this.options.header,
                content_html: this.options.content_html,
                btn_link: this.options.btn_link,
                btn_text: this.options.btn_text
            }));
            var eduBaseEl = this.$("section.mopub-Education");
            eduBaseEl.css("background-image", this.options.bg_img);
            return this
        }
    })
});
momodule("mopub.views.components", function(exports) {
    var DateRange = morequire("mopub.models.DateRange");
    exports.DatePickerView = Backbone.Marionette.ItemView.extend({
        template: JST["date_picker_view"],
        className: "btn-group datepicker-controls",
        events: {
            "click a": "preventDefault",
            "click #option-today": "rangeIsToday",
            "click #option-yesterday": "rangeIsYesterday",
            "click #option-7": "rangeIsSeven",
            "click #option-14": "rangeIsFourteen",
            "click li.custom-date-range": "stopPropagation",
            "click #custom-date-submit-btn": "rangeIsCustom"
        },
        onRender: function(datepicker_options) {
            this.rangeIsFourteen({
                silent: true
            });
            this.$(".date-picker").datepicker(datepicker_options)
        },
        displaySingleDay: function(day) {
            this.$(".calculated").html("<strong>" + day + "</strong> (" + this.model.get("endDate").format("MMMM Do, YYYY") + ")")
        },
        displayRange: function() {
            var endDate = this.model.get("endDate");
            var span = endDate.diff(this.model.get("startDate"), "days") + 1;
            var plural = span > 1 ? "s" : "";
            var yesterday = DateRange.momentWithoutTime().subtract("days", 1);
            var endDateIsYesterday = endDate.diff(yesterday, "days") === 0;
            var firstWord = endDateIsYesterday ? "Last" : "Custom";
            this.$(".calculated").html("<strong>" + firstWord + " " + span + " Day" + plural + "</strong>" + this.getNumericRange())
        },
        getNumericRange: function() {
            var startDate = this.model.get("startDate");
            var endDate = this.model.get("endDate");
            return " (" + startDate.format("M/D/YYYY") + " &mdash; " + endDate.format("M/D/YYYY") + ")"
        },
        updateModel: function(end, start) {
            this.model.setDates({
                endDate: end,
                startDate: start
            });
            this.displayRange()
        },
        rangeIsToday: function() {
            this.model.setDates({
                startDate: 0,
                endDate: 0
            });
            this.displaySingleDay("Today");
            this.selectActive("#option-today")
        },
        rangeIsYesterday: function(e, day) {
            this.model.setDates({
                startDate: 1,
                endDate: 1
            });
            this.displaySingleDay(day || "Yesterday");
            this.selectActive("#option-yesterday")
        },
        rangeIsSeven: function() {
            this.updateModel(1, 7);
            this.selectActive("#option-7")
        },
        rangeIsFourteen: function(options) {
            this.updateModel(1, 14);
            this.selectActive("#option-14", options)
        },
        rangeIsCustom: function() {
            var startArray = this.$("#datepicker-start-input").val().split("/");
            var startDate = moment.utc(startArray[2] + "-" + startArray[0] + "-" + startArray[1]);
            var endArray = this.$("#datepicker-end-input").val().split("/");
            var endDate = moment.utc(endArray[2] + "-" + endArray[0] + "-" + endArray[1]);
            this.model.set({
                startDate: startDate,
                endDate: endDate
            });
            this.displayRange();
            this.$(".datepicker-controls").removeClass("open");
            this.selectActive()
        },
        templateHelpers: {
            today: function() {
                return moment().utc().format("MMMM Do, YYYY")
            },
            yesterday: function() {
                return moment().utc().subtract("days", 1).format("MMMM Do, YYYY")
            },
            daysRange: function(days) {
                return moment().utc().subtract("days", days).format("MM/DD/YYYY") + " - " + moment().utc().subtract("days", 1).format("MM/DD/YYYY")
            },
            startDateString: function() {
                return this.startDate.format("MM/DD/YYYY")
            },
            endDateString: function() {
                return this.endDate.format("MM/DD/YYYY")
            }
        },
        preventDefault: function(e) {
            e.preventDefault()
        },
        stopPropagation: function(e) {
            e.stopPropagation()
        },
        selectActive: function(idName, options) {
            this.$("li").removeClass("active");
            this.$(idName).addClass("active");
            if (!options || options && !options.silent) {
                this.trigger("date:changed", this.model)
            }
        }
    })
});
momodule("mopub.views.components", function(exports) {
    exports.PickerItemView = Backbone.Marionette.ItemView.extend({
        template: JST["components/picker_item_view"],
        tagName: "li",
        className: "picker-item"
    });
    exports.PickerEmptyView = Backbone.Marionette.ItemView.extend({
        template: function() {
            return '<li class="muted">None</li>'
        }
    });
    exports.PickerView = Backbone.Marionette.CompositeView.extend({
        template: JST["components/picker_view"],
        itemView: exports.PickerItemView,
        emptyView: exports.PickerEmptyView,
        itemViewContainer: ".picker-items",
        isLoading: false,
        ui: {
            addButton: ".picker-add-button",
            textArea: ".picker-textarea",
            addErrorDiv: ".picker-add-error",
            addSpinnerDiv: ".picker-add-spinner",
            removeSpinnerDiv: ".picker-remove-loading",
            pickerItems: ".picker-items",
            removeErrorDiv: ".picker-remove-error",
            clearAllButton: ".picker-clear-all-button",
            clearAllModal: ".picker-clear-all-modal",
            clearAllConfirmButton: ".picker-clear-all-confirm-button"
        },
        events: {
            "click .picker-add-button": "handleAddClick",
            "click .picker-remove-button": "handleRemoveClick",
            "click .picker-clear-all-button": "handleClearAllClick"
        },
        initialize: function() {
            this.parseFunction = this.options.parseFunction;
            this.url = this.options.url;
            this.key = this.options.key;
            this.keyName = this.options.keyName;
            this.displayText = this.options.displayText;
            this.classNames = this.options.classNames;
            this.listenTo(this.collection, "add", this.updateClearAllButton);
            this.listenTo(this.collection, "remove", this.updateClearAllButton);
            this.listenTo(this.collection, "reset", this.updateClearAllButton);
            this.on("render", function() {
                this.updateClearAllButton();
                this.updateLoadingState(false)
            }.bind(this))
        },
        appendHtml: function(compositeView, itemView, index) {
            var $container = this.getItemViewContainer(compositeView);
            var children = $container.children();
            if (children.size() === index) {
                $container.append(itemView.el)
            } else {
                $container.children().eq(index).before(itemView.el)
            }
        },
        templateHelpers: function() {
            return {
                displayText: this.displayText,
                classNames: this.classNames
            }
        },
        syncItems: function(action, values, errorMessageDiv) {
            this.clearErrors();
            var data = {
                action: action,
                values: _.isArray(values) ? values : [values]
            };
            if (this.key) {
                data[this.keyName] = this.key
            }
            var request = $.ajax({
                url: this.url,
                type: "POST",
                data: data
            });
            request.fail(function(xhr) {
                var errorText;
                try {
                    errorText = JSON.parse(xhr.responseText).error
                } catch (err) {
                    errorText = "An unexpected error occurred. Please try again."
                }
                errorMessageDiv.text(errorText);
                errorMessageDiv.removeClass("hidden")
            }.bind(this));
            request.complete(function() {
                this.updateLoadingState(false)
            }.bind(this));
            return request
        },
        updateLoadingState: function(isLoading) {
            this.isLoading = isLoading;
            this.ui.pickerItems.toggleClass("loading", isLoading)
        },
        clearErrors: function() {
            this.ui.addErrorDiv.text("");
            this.ui.removeErrorDiv.text("");
            this.ui.textArea.removeClass("error")
        },
        updateClearAllButton: function() {
            this.ui.clearAllButton.css("visibility", this.collection.isEmpty() ? "hidden" : "")
        },
        handleAddClick: function() {
            if (this.isLoading) {
                return
            }
            var text = this.ui.textArea.val();
            var newItems = this.parseFunction(text);
            if (!newItems.length) {
                return
            }
            this.updateLoadingState(true);
            var request = this.syncItems("pick", newItems, this.ui.addErrorDiv);
            request.success(function() {
                this.ui.textArea.val("");
                this.collection.insertDomains(newItems)
            }.bind(this));
            request.fail(function() {
                this.ui.textArea.addClass("error")
            }.bind(this))
        },
        handleRemoveClick: function(event) {
            if (this.isLoading) {
                return
            }
            var $removeButton = $(event.target);
            var index = $removeButton.closest("li").index();
            var item = this.collection.at(index);
            var itemValue = item.get("value");
            this.updateLoadingState(true);
            var request = this.syncItems("unpick", itemValue, this.ui.removeErrorDiv);
            request.success(function() {
                item.destroy()
            }.bind(this))
        },
        handleClearAllClick: function() {
            if (this.isLoading) {
                return
            }
            this.ui.clearAllModal.modal("show");
            this.ui.clearAllConfirmButton.one("click", function() {
                this.handleClearAllConfirmClick()
            }.bind(this))
        },
        handleClearAllConfirmClick: function() {
            var items = this.collection.pluck("value");
            this.updateLoadingState(true);
            var request = this.syncItems("unpick", items, this.ui.removeErrorDiv);
            request.success(function() {
                this.collection.reset()
            }.bind(this));
            this.ui.clearAllModal.modal("hide")
        }
    })
});
momodule("mopub.views.components", function(exports) {
    var DateRange = morequire("mopub.models.DateRange");
    exports.DatePickerView = Backbone.Marionette.ItemView.extend({
        template: JST["date_picker_view"],
        className: "btn-group datepicker-controls",
        events: {
            "click a": "preventDefault",
            "click #option-today": "rangeIsToday",
            "click #option-yesterday": "rangeIsYesterday",
            "click #option-7": "rangeIsSeven",
            "click #option-14": "rangeIsFourteen",
            "click li.custom-date-range": "stopPropagation",
            "click #custom-date-submit-btn": "rangeIsCustom"
        },
        onRender: function(datepicker_options) {
            this.rangeIsFourteen({
                silent: true
            });
            this.$(".date-picker").datepicker(datepicker_options)
        },
        displaySingleDay: function(day) {
            this.$(".calculated").html("<strong>" + day + "</strong> (" + this.model.get("endDate").format("MMMM Do, YYYY") + ")")
        },
        displayRange: function() {
            var endDate = this.model.get("endDate");
            var span = endDate.diff(this.model.get("startDate"), "days") + 1;
            var plural = span > 1 ? "s" : "";
            var yesterday = DateRange.momentWithoutTime().subtract("days", 1);
            var endDateIsYesterday = endDate.diff(yesterday, "days") === 0;
            var firstWord = endDateIsYesterday ? "Last" : "Custom";
            this.$(".calculated").html("<strong>" + firstWord + " " + span + " Day" + plural + "</strong>" + this.getNumericRange())
        },
        getNumericRange: function() {
            var startDate = this.model.get("startDate");
            var endDate = this.model.get("endDate");
            return " (" + startDate.format("M/D/YYYY") + " &mdash; " + endDate.format("M/D/YYYY") + ")"
        },
        updateModel: function(end, start) {
            this.model.setDates({
                endDate: end,
                startDate: start
            });
            this.displayRange()
        },
        rangeIsToday: function() {
            this.model.setDates({
                startDate: 0,
                endDate: 0
            });
            this.displaySingleDay("Today");
            this.selectActive("#option-today")
        },
        rangeIsYesterday: function(e, day) {
            this.model.setDates({
                startDate: 1,
                endDate: 1
            });
            this.displaySingleDay(day || "Yesterday");
            this.selectActive("#option-yesterday")
        },
        rangeIsSeven: function() {
            this.updateModel(1, 7);
            this.selectActive("#option-7")
        },
        rangeIsFourteen: function(options) {
            this.updateModel(1, 14);
            this.selectActive("#option-14", options)
        },
        rangeIsCustom: function() {
            var startArray = this.$("#datepicker-start-input").val().split("/");
            var startDate = moment.utc(startArray[2] + "-" + startArray[0] + "-" + startArray[1]);
            var endArray = this.$("#datepicker-end-input").val().split("/");
            var endDate = moment.utc(endArray[2] + "-" + endArray[0] + "-" + endArray[1]);
            this.model.set({
                startDate: startDate,
                endDate: endDate
            });
            this.displayRange();
            this.$(".datepicker-controls").removeClass("open");
            this.selectActive()
        },
        templateHelpers: {
            today: function() {
                return moment().utc().format("MMMM Do, YYYY")
            },
            yesterday: function() {
                return moment().utc().subtract("days", 1).format("MMMM Do, YYYY")
            },
            daysRange: function(days) {
                return moment().utc().subtract("days", days).format("MM/DD/YYYY") + " - " + moment().utc().subtract("days", 1).format("MM/DD/YYYY")
            },
            startDateString: function() {
                return this.startDate.format("MM/DD/YYYY")
            },
            endDateString: function() {
                return this.endDate.format("MM/DD/YYYY")
            }
        },
        preventDefault: function(e) {
            e.preventDefault()
        },
        stopPropagation: function(e) {
            e.stopPropagation()
        },
        selectActive: function(idName, options) {
            this.$("li").removeClass("active");
            this.$(idName).addClass("active");
            if (!options || options && !options.silent) {
                this.trigger("date:changed", this.model)
            }
        }
    })
});
momodule("mopub.views.components", function(exports) {
    exports.BaseModal = Backbone.Marionette.Layout.extend({
        template: JST["components/base_modal"],
        className: "base-modal modal hide",
        regions: {
            body: ".base-modal-body"
        },
        initialize: function() {
            this.innerView = this.options.innerView;
            this.bindToAll()
        },
        onRender: function() {
            this.body.show(this.innerView);
            this.$el.modal({
                show: false
            })
        },
        onShow: function() {
            this.$el.modal("show");
            this.$el.on("hidden", _.bind(function() {
                this.close()
            }, this))
        },
        hide: function() {
            this.$el.modal("hide")
        },
        show: function() {
            this.$el.modal("show")
        },
        bindToAll: function() {
            this.listenTo(this.innerView, "all", this.broadCast, this)
        },
        broadCast: function() {
            var args = Array.prototype.slice.call(arguments);
            var eventName = args[0];
            var rest = args.slice(1)[0];
            this.trigger(eventName, rest)
        }
    });
    exports.Modal = exports.BaseModal.extend({
        template: JST["components/modal"],
        events: {
            "click .close": "onClose",
            "click .modal-close": "onClose",
            "click .modal-footer .btn": "onButtonClick"
        },
        triggers: {
            "click .btn-submit": "click:submit"
        },
        templateHelpers: function() {
            return {
                title: this.options.title,
                buttons: this.options.buttons || [],
                width: _.isUndefined(this.options.width) ? 600 : this.options.width
            }
        },
        onRender: function() {
            this.body.show(this.innerView);
            this.$el.modal();
            this.delegateEvents()
        },
        onButtonClick: function(event) {
            var index = $(event.currentTarget).index() - 1;
            this.trigger("click:button-" + index)
        },
        onClose: function(event) {
            this.trigger("click:close")
        }
    })
});
momodule("mopub.views.marketplace", function(exports) {
    var Domain = morequire("mopub.models.Domain");
    var DomainCollection = morequire("mopub.models.DomainCollection");
    var parseDomains = morequire("mopub.models.parseDomains");
    var PickerView = morequire("mopub.views.components.PickerView");

    function dateToMDYString(date) {
        var d = date.getDate();
        var m = date.getMonth() + 1;
        var y = date.getFullYear();
        return "" + (m <= 9 ? "0" + m : m) + "-" + (d <= 9 ? "0" + d : d) + "-" + y
    }

    function getOrigin() {
        var origin;
        if (!window.location.origin) {
            origin = window.location.protocol + "//" + window.location.host + "/";
            window.location.origin = origin
        } else {
            origin = window.location.origin
        }
        return origin
    }

    function handleBlock(action, type, ids, line_item_key) {
        var url = "/advertise/marketplace/blocking/" + type + "/";
        var data = {
            action: action,
            ids: ids
        };
        if (line_item_key) data.line_item_key = line_item_key;
        var block_deferred = $.ajax({
            url: url,
            type: "POST",
            data: data,
            success: function() {
                MarketplaceGroundControl.trigger(action + "-" + type, ids)
            }
        });
        return block_deferred
    }
    exports.DspTableView = Backbone.View.extend({
        el: "#dsp-table",
        template: JST["marketplace/dsp_table"],
        render: function() {
            var that = this;
            var dsp_deferred = $.ajax({
                url: "/advertise/marketplace/demand_report/",
                cache: false,
                dataType: "json",
                data: {
                    pub_id: this.options.pub_key,
                    start: dateToMDYString(this.options.start_date),
                    end: dateToMDYString(this.options.end_date)
                }
            });
            dsp_deferred.success(function(dsp_data) {
                var content = that.template({
                    dsps: _.map(dsp_data, function(dsp) {
                        return {
                            name: dsp.name,
                            revenue: mopub.Utils.formatCurrency(dsp.stats.pub_rev),
                            ecpm: mopub.Utils.formatCurrency(dsp.stats.pub_rev * 1e3 / dsp.stats.imp),
                            impressions: mopub.Utils.formatNumberWithCommas(dsp.stats.imp)
                        }
                    })
                });
                that.$el.html(content);
                that.$(".table").tablesorter({
                    sortDir: "desc",
                    sortList: [
                        [1, 1]
                    ]
                });
                that.$(".table").stickyTableHeaders()
            });
            return this
        }
    });
    exports.initializeDomainBlocklist = function(selector, blocked_domains, line_item_key) {
        var domain_blocklist = _.map(blocked_domains, function(val) {
            return {
                value: val
            }
        });
        var add_placeholder = "Enter domains in the format “advertisername.com”. " + "Entries must be at least 3 characters. " + "MoPub blocks any buyer domains that contain the exact text entered in this field.";
        var options = {
            el: selector,
            displayText: {
                addLabel: "Add domain(s) to the blacklist",
                addPlaceholder: add_placeholder,
                pickedLabel: "Currently on blacklist"
            },
            classNames: {
                addRegion: "offset1 span5",
                pickedRegion: "span4"
            },
            collection: new DomainCollection(domain_blocklist),
            parseFunction: parseDomains,
            url: "/advertise/marketplace/blocking/domain/"
        };
        if (line_item_key) {
            options.keyName = "line_item_key";
            options.key = line_item_key
        }
        return new PickerView(options)
    };
    exports.BlockSelectionView = Backbone.View.extend({
        el: "#marketplace_block_selection",
        events: {
            "click .blockOption": "handleBlock"
        },
        handleBlock: function(event) {
            var that = this;
            var action = event.currentTarget.attributes["data-action"].value;
            var type = event.currentTarget.attributes["data-type"].value;
            var ids = $.map($(".selection_item:checked"), function(val, index) {
                return String($(val).data(type))
            });
            handleBlock(action, type, ids, this.options.line_item_key)
        }
    });
    exports.CreativeTableView = Backbone.View.extend({
        el: "#report-table",
        creative_blocked: function(domain, creative_id) {
            var blocked_on_creative = this.options.blocked_creatives.indexOf(creative_id) > -1;
            var blocked_on_url = this.options.blocked_domains.indexOf(domain) > -1;
            return blocked_on_creative || blocked_on_url
        },
        render: function() {
            var that = this;
            var origin = getOrigin();
            var start_date_str = dateToMDYString(that.options.start_date);
            var end_date_str = dateToMDYString(that.options.end_date);
            var creative_data_url = origin + "/advertise/marketplace/creatives/";
            var table = that.$el.dataTable({
                aLengthMenu: [10, 25],
                bProcessing: true,
                bJQueryUI: true,
                sPaginationType: "full_numbers",
                oLanguage: {
                    sEmptyTable: "No creatives have been displayed for this time range."
                },
                aoColumns: function() {
                    return [{
                        sWidth: "49px"
                    }, {
                        sWidth: "330px"
                    }, {
                        sWidth: "190px"
                    }, {
                        sWidth: "120px"
                    }, {
                        sWidth: "120px"
                    }, {
                        sWidth: "90px"
                    }, {
                        sWidth: "90px"
                    }]
                }(),
                bAutoWidth: false,
                aaSorting: function() {
                    return [
                        [4, "desc"]
                    ]
                }(),
                sAjaxSource: creative_data_url,
                fnServerData: function(sUrl, aoData, fnCallback) {
                    var dsp_deferred = $.ajax({
                        url: origin + "/advertise/marketplace/bidder_names/",
                        cache: false,
                        dataType: "json"
                    });
                    var creative_data = {
                        pub_id: that.options.pub_id,
                        start: start_date_str,
                        end: end_date_str,
                        format: "json"
                    };
                    if (that.options.hasOwnProperty("campaign_key")) {
                        creative_data["adserver_campaign"] = that.options.campaign_key
                    }
                    if (that.options.hasOwnProperty("adgroup_key")) {
                        creative_data["adserver_adgroup"] = that.options.adgroup_key
                    }
                    var creative_deferred = $.ajax({
                        url: sUrl,
                        data: creative_data,
                        dataType: "json",
                        cache: false
                    });
                    $.when(dsp_deferred, creative_deferred).done(function(dsp_params, creative_params) {
                        var dsp_id_to_name = JSON.parse(dsp_deferred.responseText);
                        var creatives = creative_params[0];
                        for (var key in creatives) {
                            if (creatives.hasOwnProperty(key)) {
                                var creative = creatives[key];
                                creative.dsp_name = dsp_id_to_name[creative.creative.dsp]
                            }
                        }
                        var creative_data = _.map(creatives, function(creative, key) {
                            var ecpm = creative["stats"]["pub_rev"] / (creative["stats"]["imp"] + 1) * 1e3;
                            var creative_id = creative["creative"]["dsp"] + ":" + creative["creative"]["crtv_id"];
                            var domain = creative["creative"]["ad_dmn"];
                            var data = [String(that.creative_blocked(domain, creative_id)), creative["creative"]["url"], domain, creative["dsp_name"] || "(Unavailable)", creative["stats"]["pub_rev"], creative["stats"]["imp"], ecpm, creative_id];
                            return data
                        });
                        var response = {
                            aaData: creative_data
                        };
                        fnCallback(response, creative_params[1], creative_params[2])
                    })
                },
                fnRowCallback: function(nRow, aData, iDisplayIndex) {
                    var creative_url = aData[1].replace(/(<([^>]+)>)/g, "");
                    var domain = aData[2];
                    var dsp_name = aData[3];
                    var revenue = aData[4];
                    var impressions = aData[5];
                    var ecpm = aData[6];
                    var creative_id = aData[7];
                    var creative_blocked = _(that.options.blocked_creatives).indexOf(creative_id) > -1;
                    var domain_blocked = _(that.options.blocked_domains).indexOf(domain) > -1;
                    var td = mopub.Utils.tdForColumn;
                    var startColumnIndex = 0;
                    var blocking_status = new exports.BlockingStatusView({
                        el: $(td(startColumnIndex++), nRow),
                        creative_id: creative_id,
                        domain: domain,
                        creative_blocked: creative_blocked,
                        domain_blocked: domain_blocked
                    });
                    blocking_status.render();
                    $(td(startColumnIndex++), nRow).html("<div class='creative-link'><a href=\"" + creative_url + '" target="_">Preview creative</a></div>');
                    $(td(startColumnIndex++), nRow).html(domain);
                    $(td(startColumnIndex++), nRow).html(dsp_name);
                    $(td(startColumnIndex++), nRow).text(mopub.Utils.formatCurrency(revenue));
                    $(td(startColumnIndex++), nRow).text(mopub.Utils.formatNumberWithCommas(impressions));
                    $(td(startColumnIndex++), nRow).text(mopub.Utils.formatCurrency(ecpm));
                    return nRow
                }
            });
            return table
        }
    });
    exports.BlockingStatusView = Backbone.View.extend({
        template: JST["marketplace/marketplace_blocking"],
        onRender: function() {
            window.MarketplaceGroundControl.on("block-creative", function(message) {
                if (_(message).contains(this.options.creative_id)) {
                    this.options.creative_blocked = true;
                    this.render()
                }
            }, this);
            window.MarketplaceGroundControl.on("block-domain", function(message) {
                if (_(message).contains(this.options.domain)) {
                    this.options.domain_blocked = true;
                    this.render()
                }
            }, this);
            window.MarketplaceGroundControl.on("unblock-creative", function(message) {
                if (_(message).contains(this.options.creative_id)) {
                    this.options.creative_blocked = false;
                    this.render()
                }
            }, this);
            window.MarketplaceGroundControl.on("unblock-domain", function(message) {
                if (_(message).contains(this.options.domain)) {
                    this.options.domain_blocked = false;
                    this.render()
                }
            }, this)
        },
        render: function() {
            var blocking_html = this.template({
                creative_id: String(this.options.creative_id),
                domain: this.options.domain,
                creative_blocked: this.options.creative_blocked,
                domain_blocked: this.options.domain_blocked
            });
            this.$el.html(blocking_html);
            this.renderPopover();
            this.onRender();
            return this
        },
        renderPopover: function() {
            var popover_content = "";
            if (this.options.creative_blocked) {
                popover_content += "<div>Creative ID</div>"
            }
            if (this.options.domain_blocked) {
                popover_content += "<div>Advertiser URL</div>"
            }
            if (popover_content !== "") {
                this.$(".marketplace-blocking-status").popover({
                    delay: 0,
                    title: "Blocked By",
                    content: popover_content,
                    html: true,
                    trigger: "hover"
                })
            } else {
                this.$("marketplace-blocking-status").popover("destroy")
            }
            return this
        }
    });
    var EducationModuleView = morequire("mopub.views.components.EducationModuleView");
    exports.MarketplaceEducationView = EducationModuleView.extend({
        el: "#marketplace-edu",
        options: {
            header: "Why should I use MoPub Marketplace?",
            content_html: "<p>MoPub Marketplace competes with your network partners to maximize " + "your revenue for every ad impression.</p>" + "<p>To access MoPub Marketplace, please enter your payment information " + "in your MoPub Settings.</p>",
            btn_link: "/account/payments/info",
            btn_text: "Enter payment info",
            bg_img: "url(/public/images/marketplace_enhancements/edu_bg.png)"
        }
    })
});
var MAX_VIEWPORT_HEIGHT_RATIO = .9;
momodule("mopub.views.sheets", function(exports) {
    exports.SheetView = function(options) {
        this.template = JST["sheets/sheet"];
        this.defaultOptions = {
            delayForShowing: 10,
            baseAnimationTime: 300,
            footerAnimationTime: 100,
            hasFooter: false,
            sheetClasses: [],
            bodyClasses: []
        };
        if (!options.$content) {
            throw new TypeError("Missing $content, which must be jQuery element or HTML string")
        }
        options = $.extend({}, this.defaultOptions, options);
        var sheetClasses = options.sheetClasses.concat(["sheet"]).join(" ");
        this.$el = $("<div>").addClass(sheetClasses).toggleClass("with-fixed-footer", !!options.hasFooter).html(this.template(options));
        this.$ = function(selector) {
            return this.$el.find(selector)
        };
        this.on = function(event, callback) {
            this.$el.on(event, callback)
        };
        this.off = function(event) {
            this.$el.off(event)
        };
        this.trigger = function(event, data) {
            this.$el.trigger(event, data)
        };
        this.teardown = function() {
            this.$el.remove();
            if (this.hideTimeout) {
                window.clearTimeout(this.hideTimeout)
            }
            if (this.showTimeout) {
                window.clearTimeout(this.showTimeout)
            }
        };
        this.togglePageScrolling = function(enabled) {
            $("html,body").css("overflow", enabled ? "auto" : "hidden")
        };
        this.calibrateContainerScrolling = function(forceToScroll) {
            if (forceToScroll === false) {
                this.$wrapper.removeClass("with-scroll")
            } else if (forceToScroll === true) {
                this.$wrapper.addClass("with-scroll")
            } else {
                var maxViewportHeight = $(window).height() * MAX_VIEWPORT_HEIGHT_RATIO;
                this.$wrapper.toggleClass("with-scroll", this.$content.height() > maxViewportHeight)
            }
        };
        this.renderBody = function($content) {
            this.$body.empty().append($content);
            this.calibrateContainerScrolling()
        };
        this.renderFooter = function($footer) {
            this.$footer.empty().append($footer)
        };
        this.renderTitle = function(str) {
            this.$(".sheet-title").text(str)
        };
        this.renderSubheader = function(str) {
            this.$(".subheader").text(str)
        };
        this.hide = function() {
            this.trigger("beforeHide");
            this.togglePageScrolling(true);
            this.$wrapper.removeClass("open");
            this.$(".sheet-footer-wrapper").fadeOut(options.footerAnimationTime);
            this.$overlay.fadeOut(options.baseAnimationTime);
            this.hideTimeout = window.setTimeout(function() {
                this.trigger("afterHide");
                this.teardown()
            }.bind(this), options.baseAnimationTime)
        };
        this.show = function() {
            this.trigger("beforeShow");
            this.$el.appendTo(document.body).show();
            $(window).resize(this.calibrateContainerScrolling.bind(this));
            this.$overlay = this.$(".sheet-overlay").click(this.hide.bind(this));
            this.$wrapper = this.$(".sheet-wrapper").click(this.hide.bind(this));
            this.$headerWrapper = this.$(".sheet-header-wrapper");
            var stopPropagation = function(e) {
                e.stopPropagation()
            };
            this.$content = this.$wrapper.find(".sheet-content");
            this.$content.on("click", stopPropagation);
            this.$body = this.$(".sheet-template");
            this.renderBody(options.$content);
            this.$(".sheet-close").click(this.hide.bind(this));
            this.$el.on("hidesheet", this.hide.bind(this));
            this.showTimeout = window.setTimeout(function() {
                this.$overlay.fadeIn(options.baseAnimationTime);
                this.$wrapper.addClass("open");
                this.trigger("afterShow")
            }.bind(this), options.delayForShowing);
            this.$title = this.$(".sheet-title");
            this.$footer = this.$(".sheet-footer");
            this.togglePageScrolling(false)
        }
    };
    exports.SheetView.showSample = function(numberOfLines) {
        numberOfLines = numberOfLines || 100;
        var sheet = new exports.SheetView({
            $content: $("<div>").html(new Array(numberOfLines + 1).join("foo<br>")),
            title: "Test",
            subheader: "This is a test sheet"
        });
        sheet.show()
    }
});
momodule("mopub.views", function(exports) {
    exports.TOSModal = Backbone.Marionette.ItemView.extend({
        class: "modal hide fade container",
        id: "tosModal",
        template: JST.tos_modal,
        events: {
            "change .acknowledged-box": "acknowledgeChanged",
            "click .remind-later": "remindLater",
            "click .accept": "acceptTos"
        },
        onRender: function() {
            if (this.model.get("allow_tos_remind_later") === false) {
                this.$(".remind-later").remove()
            }
        },
        acknowledgeChanged: function() {
            this.model.set("acknowledged", this.$(".acknowledged-box").prop("checked"));
            this.render()
        },
        remindLater: function() {
            var key = this.model.get("tos_tracking_key");
            var cookie_name = "tos_reminder_timestamp_".concat(key);
            var modal_timestamps = $.cookie(cookie_name);
            current_time = $.now();
            $.cookie(cookie_name, String(current_time), {
                path: "/",
                domain: "mopub.com",
                secure: true
            });
            this.$el.modal("hide")
        },
        acceptTos: function() {
            if (this.model.get("acknowledged") === true) {
                this.$(".spinner").removeClass("hide");
                var that = this;
                $.post("/account/accept-tos/").done(function() {
                    that.$el.modal("hide")
                }).always(function() {
                    that.$(".spinner").addClass("hide")
                });
                var key = this.model.get("tos_tracking_key");
                var cookie_name = "tos_reminder_timestamp_".concat(key);
                $.removeCookie(cookie_name, {
                    path: "/",
                    domain: "mopub.com",
                    secure: true
                })
            } else {
                this.$(".not-acknowledged-tos").show()
            }
        }
    })
});
momodule("mopub.views.components", function(exports) {
    exports.FrequencyCapView = Backbone.Marionette.ItemView.extend({
        template: JST["components/frequency_caps"],
        className: "fcap",
        events: {
            "click .remove": function() {
                if (this.options.amITheLast()) this.$(".number").val(null);
                else this.remove();
                this.options.triggerChange()
            }
        },
        onRender: function() {
            this.$(".interval").val(this.model.get("interval"))
        }
    });
    var buildView$El = function(container, datum) {
        return new exports.FrequencyCapView({
            model: new Backbone.Model({
                value: datum.value,
                interval: datum.interval
            }),
            triggerChange: function() {
                return container.trigger("changeFrequencyCap")
            },
            amITheLast: function() {
                return container.$(".fcap").length === 1
            }
        }).render().$el
    };
    var readCaps = function(arr) {
        return {
            interval: arr[0],
            value: arr[1]
        }
    };
    exports.FrequencyCapContainer = Backbone.Marionette.ItemView.extend({
        template: JST["components/frequency_caps_container"],
        events: {
            "click #add-another-fcap": "addFrequencyCap"
        },
        initialize: function() {
            this.listenTo(this, "changeFrequencyCap", function() {
                var nCaps = this.$(".fcap").length;
                if (nCaps >= 3) {
                    this.$("#add-another-fcap").hide();
                    this.$("#frequency-cap-widget-container").css("margin-bottom", "-13px")
                } else {
                    this.$("#add-another-fcap").show();
                    this.$("#frequency-cap-widget-container").css("margin-bottom", "0px")
                }
            })
        },
        addFrequencyCap: function() {
            var newCap = [3600, null];
            this.$("#frequency-cap-widget-container").append(buildView$El(this, readCaps(newCap)));
            this.trigger("changeFrequencyCap")
        },
        setData: function(caps) {
            var view$Els = caps.map(readCaps).map(_.partial(buildView$El, this));
            $.fn.append.apply(this.$("#frequency-cap-widget-container").html(""), view$Els);
            return this
        },
        getData: function() {
            var data = _.map(this.$(".fcap"), function(el) {
                return [$(el).find(".interval").val(), $(el).find(".number").val()].map(Number)
            });
            return data.map(function(arr) {
                return [arr[0], arr[1] || null]
            })
        },
        serializeData: function() {
            return JSON.stringify(this.getData().filter(function(arr) {
                return arr[1]
            }))
        }
    })
});
momodule("mopub.views.accounts", function(exports) {
    exports.RemoveUserModal = Backbone.Marionette.ItemView.extend({
        template: JST["accounts/manage_users_remove_modal"],
        events: {
            "click #modal-submit": "confirmRemoveUser",
            "click #modal-dismiss": "dismissModal"
        },
        initialize: function(options) {
            this.parent = options.parent
        },
        confirmRemoveUser: function(e) {
            var that = this;
            $.ajax({
                url: "/account/users/api/{}/{}/".format(this.parent.model.get("type"), this.parent.model.id),
                type: "DELETE"
            }).done(function() {
                that.parent.parent.collection.remove(that.parent.model)
            }.bind(this.parent));
            this.$el.modal("hide")
        },
        dismissModal: function(e) {
            this.$el.modal("hide")
        },
        templateHelpers: function() {
            return {
                email: this.parent.options.model.attributes.email
            }
        }
    });
    exports.RoleExplanationModal = Backbone.Marionette.ItemView.extend({
        template: JST["accounts/manage_users_role_explanation_modal"],
        events: {
            "click #modal-dismiss": "dismissModal"
        },
        dismissModal: function(e) {
            this.$el.modal("hide")
        }
    });
    exports.ManageUsersTableRow = Backbone.Marionette.ItemView.extend({
        template: JST["accounts/manage_users_table_row"],
        tagName: "tr",
        className: "manage-users-table-row",
        events: {
            "click .remove": "removeUser",
            "click .resend-invite": "resendInvite",
            "change .permission": "changePermission",
            "focus .permission": "resetErrors"
        },
        initialize: function(options) {
            this.parent = options.parent
        },
        removeUser: function(e) {
            new exports.RemoveUserModal({
                parent: this
            }).render().$el.modal();
            this.resetErrors(e)
        },
        resendInvite: function(e) {
            $.post("/account/users/api/", {
                email: this.model.get("email"),
                permission: this.model.get("permission")
            }).done(function() {
                this.$(".resend-invite").replaceWith('<i class="muted">Invite sent</i>')
            }.bind(this))
        },
        changePermission: function(e) {
            this.model.set("permission", this.$(".permission").val());
            $.ajax({
                url: "/account/users/api/{}/{}/{}/".format(this.model.get("type"), this.model.id, this.$(".permission").val()),
                type: "PUT"
            }).fail(function() {
                this.model.set("permission", this.model.previous("permission"));
                this.render()
            }.bind(this))
        },
        resetErrors: function(e) {
            this.parent.resetErrors()
        },
        templateHelpers: function() {
            return {
                showRemove: !this.model.get("isCurrentAdmin"),
                isReadOnly: this.parent.isReadOnly
            }
        }
    });
    exports.ManageUsersView = Backbone.Marionette.CompositeView.extend({
        template: JST["accounts/manage_users_view"],
        className: "manage-users-view",
        itemView: exports.ManageUsersTableRow,
        itemViewContainer: "#manage-users-table-body",
        events: {
            "click #invite-user": "inviteUser",
            "click #role_explanation_modal": "showRoleExplanationModal",
            "focus #add-user-type": "resetErrors",
            "keyup #add-user-email": "resetErrors"
        },
        initialize: function(options) {
            this.isReadOnly = options.dataElement.data("manage_users_readonly");
            this.itemViewOptions = {
                parent: this
            };
            var userPermissionsTupleList = options.dataElement.data("users_permissions");
            this.collection = this._buildCollection(userPermissionsTupleList)
        },
        inviteUser: function(e) {
            var xhr = $.post("/account/users/api/", {
                email: this.$("#add-user-email").val(),
                permission: this.$("#add-user-type").val()
            });
            xhr.done(function(response) {
                this.collection.add([response], {
                    merge: true
                });
                this.render()
            }.bind(this));
            xhr.fail(function(response) {
                this.$("#add-user-email").addClass("error");
                this.$("#email-error").removeClass("hidden").text(response.responseText)
            }.bind(this))
        },
        showRoleExplanationModal: function(e) {
            (new exports.RoleExplanationModal).render().$el.modal();
            this.resetErrors(e)
        },
        _buildCollection: function(userPermissionsTupleList) {
            var modelFactory = function(id, email, permission, identifier, type) {
                return new Backbone.Model({
                    id: id,
                    email: email,
                    permission: permission,
                    identifier: identifier,
                    type: type,
                    isCurrentAdmin: this.options.dataElement.data("current_account_user_id") === id
                })
            }.bind(this);
            return new Backbone.Collection(_.map(userPermissionsTupleList, _.splat(modelFactory)))
        },
        resetErrors: function(e) {
            this.$("#add-user-email").removeClass("error");
            this.$("#email-error").addClass("hidden")
        },
        templateHelpers: function() {
            return {
                isReadOnly: this.isReadOnly
            }
        }
    })
});
momodule("mopub.views.accounts", function(exports) {
    var PaymentInfoSettingsModel = morequire("mopub.models.accounts.PaymentInfoSettingsModel");
    var SaveAndErrorTrackingView = morequire("mopub.views.mixins.SaveAndErrorTrackingView");
    exports.PaymentInfoSettingsView = Backbone.Marionette.ItemView.extend({
        template: JST["accounts/payment_info_settings_view"],
        model: new PaymentInfoSettingsModel,
        initialize: function() {
            this.model.fetch({
                success: function() {
                    this.model.set({
                        country: this.model.get("country") || "US",
                        payment_preference: this.model.get("payment_preference") || "paypal",
                        account_number_type: this.model.get("iban_display") ? "iban" : "default"
                    })
                }.bind(this)
            })
        },
        onRender: function() {
            this.onChangeCountry();
            this.onChangeBankCountry();
            this.onChangePaymentPreference();
            this.onChangeAccountNumberType();
            this.processErrors()
        },
        events: {
            "change #id_country": "onChangeCountry",
            "change #id_bank_country": "onChangeBankCountry",
            "click #payment_preference_paypal": "onChangePaymentPreference",
            "click #payment_preference_wire": "onChangePaymentPreference",
            "click input[name='account_number_type']": "onChangeAccountNumberType",
            "click #paymentinfo-submit": "onClickSubmit"
        },
        modelEvents: {
            change: "render"
        },
        fieldErrorsHandler: function(field, errorList) {
            var errorString = errorList.join("<br />");
            if (field === "tos_accepted") {
                this.$(".terms_of_service").append('<p class="error">{}</p>'.format(errorString))
            } else if (field === "meta_account_number_or_iban") {
                this.$("#emea_account_number").append('<label class="error">{}</label>'.format(errorString))
            } else {
                this.$('[name="{}"]'.format(field)).filter(":visible").addClass("error").after('<label class="error">{}</label>'.format(errorString))
            }
        },
        onChangeCountry: function() {
            var val = this.$("#id_country").val();
            if (val === "US") {
                this.$(".country_us_only").show();
                this.$(".country_non_us_only").hide()
            } else {
                this.$(".country_us_only").hide();
                this.$(".country_non_us_only").show()
            }
        },
        onChangeBankCountry: function() {
            var val = this.$("#id_bank_country").val();
            var regions = this.model.get("PAYMENT_INFO_REGIONS");
            var showAll = function(selector) {
                return this.$(selector).show()
            };
            this.$(".bank_country_dependent").hide();
            val == "US" ? showAll(".bank_country_us_only") : showAll(".bank_country_non_us_only");
            _(regions.EMEA).contains(val) ? showAll(".bank_country_emea_only") : showAll(".bank_country_non_emea_only");
            _(regions.APAC_SPECIAL).contains(val) ? showAll(".bank_country_apac_special_only") : null
        },
        onChangePaymentPreference: function() {
            if (this.$("#payment_preference_paypal").is(":checked")) {
                this.$("#wire_only").fadeOut(10);
                this.$("#paypal_only").fadeIn()
            } else {
                this.$("#paypal_only").fadeOut(10);
                this.$("#wire_only").fadeIn()
            }
        },
        onChangeAccountNumberType: function() {
            var val = $('[name="account_number_type"]:checked').val();
            this.$('#emea_account_number input[type="text"]').hide().filter("#id_account_number_".concat(val)).show()
        },
        onClickSubmit: function() {
            var removeHidden = _.partial(_.filter, _, function(field) {
                var $els = $('[name="{}"]'.format(field)).filter(":visible");
                return $els.length
            });
            var basicFields = removeHidden(["country", "business_name", "us_tax_id", "local_tax_id", "paypal_email", "beneficiary_name", "bank_name", "bank_address", "bank_country", "account_type", "bank_number", "branch_number", "account_number", "iban", "ach_routing_number", "bank_swift_code"]);
            var radioFields = removeHidden(["payment_preference"]);
            var checkboxFields = removeHidden(["tos_accepted"]);
            var updates = _.object([].concat(_.map(basicFields, function(field) {
                return [field, this.$('[name="{}"]'.format(field)).filter(":visible").val()]
            }, this), _.map(radioFields, function(field) {
                return [field, this.$('[name="{}"]:checked'.format(field)).val()]
            }, this), _.map(checkboxFields, function(field) {
                return [field, this.$('[name="{}"]'.format(field)).is(":checked")]
            }, this)));
            this.model.save(updates, {
                patch: true,
                type: "POST"
            }).done(_.partial(this.redirectToUrl, this.options.dataElement.data("redirect_url")))
        },
        redirectToUrl: function(url) {
            window.location = url
        }
    });
    _.extend(exports.PaymentInfoSettingsView.prototype, SaveAndErrorTrackingView)
});
momodule("mopub.views.accounts", function(exports) {
    var PrimaryAdminSettingsModel = morequire("mopub.models.accounts.PrimaryAdminSettingsModel");
    var SaveAndErrorTrackingView = morequire("mopub.views.mixins.SaveAndErrorTrackingView");
    exports.PrimaryAdminSettingsView = Backbone.Marionette.ItemView.extend({
        template: JST["accounts/primary_admin_settings_view"],
        model: new PrimaryAdminSettingsModel,
        initialize: function() {
            this.render();
            this.model.fetch()
        },
        onRender: function() {
            this.processErrors()
        },
        modelEvents: {
            change: "render"
        },
        events: {
            'change [name="primary_admin"]': "changePrimaryAdmin"
        },
        changePrimaryAdmin: function() {
            this.model.save("primary_admin", this.$('[name="primary_admin"]').val())
        }
    });
    _.extend(exports.PrimaryAdminSettingsView.prototype, SaveAndErrorTrackingView)
});
momodule("mopub.views.publisher.forms", function(exports) {
    var App = morequire("mopub.models.publisher.App");
    var AdUnit = morequire("mopub.models.publisher.AdUnit");
    var Publisher = morequire("mopub.models.publisher");
    var isSwitchEnabled = morequire("mopub.gargoyle.isSwitchEnabled");
    var setupSaveRewardedCurrency = morequire("mopub.utilities.rewardedVideoCurrency.setupSaveRewardedCurrency");
    var APP_CATEGORY_CHOICES = morequire("mopub.models.publisher.APP_CATEGORY_CHOICES");
    Backbone.Stickit.addHandler({
        selector: "img",
        events: ["change", "propertychange"],
        getVal: function($el) {
            return $el.prop("src")
        }
    });
    var AppForm = Backbone.Marionette.ItemView.extend({
        template: JST["publisher/app_form"],
        prefix: "app",
        initialize: function() {
            var that = this;
            this.model.on("change", function() {
                this.validate();
                that.render()
            })
        },
        ui: {
            iconPreview: "#app-image-serve-url",
            imageUploadingIndicator: "#app-icon-upload .imageUploadingIndicator"
        },
        events: {
            "change #appForm-icon-upload": function(e) {
                $("#app-form-submit").prop("disabled", true);
                this.ui.imageUploadingIndicator.show();
                var that = this;
                var xhr = mopub.Utils.fileUploadHandler(e, "/inventory/app_icon/upload/").done(function(image) {
                    that.model.set("image_serve_url", image.url);
                    that.$el.find("#app-image-serve-url-errors").empty()
                }).fail(function(resp) {
                    that.$el.find("#app-image-serve-url-errors").empty().append(resp.errors)
                }).always(function() {
                    that.ui.imageUploadingIndicator.hide()
                })
            },
            "click #app-store-search": function() {
                this.openTypeahead()
            }
        },
        bindings: {
            "input[name=app_type]": "app_type",
            "input[name=name]": {
                observe: "name",
                events: ["blur", "focus"]
            },
            "input[name=url]": {
                observe: "url",
                events: ["blur"]
            },
            "input[name=package]": {
                observe: "package",
                events: ["blur"]
            },
            "select[name=primary_category]": "primary_category",
            "select[name=secondary_category]": "secondary_category",
            "#app-image-serve-url": "image_serve_url",
            "input[name=coppa_blocked]": {
                observe: ["coppa_acknowledged", "coppa_blocked"],
                onSet: function(value) {
                    this.model.set("coppa_acknowledged", true);
                    this.model.set("coppa_blocked", value === "True");
                    return value === "True"
                },
                onGet: function(value) {
                    const coppa_ack = value[0];
                    const coppa_blocked = value[1];
                    return coppa_ack ? coppa_blocked ? "True" : "False" : null
                }
            },
            "input[name=coppa_acknowledged]": {
                observe: "coppa_acknowledged"
            }
        },
        onRender: function() {
            Backbone.Validation.bind(this);
            this.stickit();
            if (this.model.get("app_type") === "iphone") {
                this.startTypeahead()
            }
        },
        templateHelpers: function() {
            var that = this;
            return {
                shouldCheck: function(fieldName, value) {
                    return that.model.get(fieldName) === value ? "checked=checked" : ""
                },
                shouldSelect: function(fieldName, value) {
                    return that.model.get(fieldName) === value ? "selected=selected" : ""
                },
                shouldDisplay: function(fieldName, value) {
                    return that.model.get(fieldName) === value ? "" : "style='display: none;'"
                },
                categoryChoices: APP_CATEGORY_CHOICES,
                isCreateForm: typeof this.model.id === "undefined"
            }
        },
        startTypeahead: function() {
            var that = this;
            var parseResults = function(results) {
                return _.map(results.slice(0, 5), function(result) {
                    return {
                        value: result.trackName,
                        name: result.trackName,
                        tokens: [result.trackName],
                        image: result.artworkUrl60,
                        url: result.trackViewUrl,
                        primaryCategory: result.primaryGenreName ? result.primaryGenreName.toLowerCase() : undefined
                    }
                })
            };
            var appSearch = function(query, cb) {
                $.getJSON("/inventory/app_search/", {
                    term: query
                }, function(resp) {
                    cb(parseResults(resp))
                })
            };
            this.$("#app-name-field").typeahead({
                minLength: 100,
                highlight: true
            }, {
                name: "my-dataset",
                source: appSearch,
                templates: {
                    suggestion: JST["publisher/app_search_result"]
                }
            });
            this.$("#app-name-field").on("typeahead:selected", function(event, selectedItem) {
                that.model.set({
                    url: selectedItem.url,
                    image_serve_url: mopub.Utils.removeProtocol(selectedItem.image),
                    name: selectedItem.name,
                    primary_category: selectedItem.primaryCategory
                });
                that.$("#app-image-serve-url").attr("src", selectedItem.image).change()
            })
        },
        openTypeahead: function() {
            var typeahead = this.$("#app-name-field").data("ttTypeahead");
            var query = typeahead.input.getQuery();
            typeahead.input.focus();
            typeahead.dropdown.update(query);
            typeahead.dropdown.open()
        },
        stopTypeahead: function() {
            this.$("#app-name-field").typeahead("destroy")
        },
        submitHandler: function() {
            return this.save({
                commit: true
            })
        },
        validateCoppa: function() {
            var $checkboxes = $("#coppa-checkbox, #appForm-coppa-yes, #appForm-coppa-no");
            if ($checkboxes.is(":checked")) {
                return true
            }
            $checkboxes.attr("required", "required")
        }
    });
    var AdUnitForm = Backbone.Marionette.ItemView.extend({
        template: JST["publisher/adunit_form"],
        prefix: "adunit",
        initialize: function(options) {
            this.app = options.app;
            this.rewardedVideoCurrencyCollection = options.rewardedVideoCurrencyCollection;
            this.fetchRewardedVideoCurrencyCollection = options.fetchRewardedVideoCurrencyCollection;
            var model = this.model,
                app = this.app,
                that = this;
            app.on("change", function() {
                if (app.hasChanged("app_type")) {
                    var formatsHash = model.get("device_format") === "phone" ? Publisher.getPhoneFormats() : Publisher.getTabletFormats();
                    if (app.get("app_type") === "mweb" && model.get("format") === "native") {
                        model.set("format", formatsHash[0]["value"])
                    }
                    that.render()
                }
            });
            this.model.on("change", function(msg) {
                var format = this.model.get("format");
                var formatsHash = this.model.get("device_format") === "phone" ? Publisher.getPhoneFormats() : Publisher.getTabletFormats();
                if (this.model.hasChanged("format")) {
                    var formatEntry = _.find(formatsHash, function(formatEntry) {
                        return formatEntry["value"] === format
                    });
                    if (formatEntry) {
                        var newName = "{0} Ad".format(formatEntry["label"]).capitalize();
                        if (this.model.hasDefaultName()) {
                            this.model.set({
                                name: newName
                            }, {
                                silent: true
                            })
                        }
                    }
                }
                if (this.model.hasChanged("device_format")) {
                    var formats = _.pluck(formatsHash, "value");
                    if (formats.indexOf(format) < 0) {
                        this.model.set({
                            format: formats[0]
                        })
                    }
                }
                this.model.validate();
                this.render()
            }, this)
        },
        events: {
            "click #adunit-repeat_interval_checkbox": function(e) {
                $el = $(e.target);
                var position_data = this.model.get("native_positioning_data");
                if ($el.is(":checked")) {
                    position_data.repeating = {
                        interval: this.old_native_position_interval || this.model.native_position_interval_default
                    }
                } else {
                    if (_.has(position_data.repeating, "interval")) {
                        this.old_native_position_interval = position_data.repeating.interval
                    }
                    delete position_data.repeating
                }
                this.model.set("native_positioning_data", position_data);
                this.render()
            },
            "change input[name=adunit-frequency_cap_yes-field]": function(e) {
                this.isFrequencyCapChecked = $(e.target).is(":checked");
                if (!this.isFrequencyCapChecked) {
                    this.model.set({
                        daily_impression_cap: 0,
                        hourly_impression_cap: 0
                    })
                } else {
                    this.model.set({})
                }
                this.render()
            }
        },
        ui: {
            frequency_checkbox: "input[name=adunit-frequency_cap_yes-field]",
            right_box: ".adunit-edit-right"
        },
        bindings: {
            "select[name=device-format]": "device_format",
            "select[name=format]": {
                observe: "format",
                onSet: function(value) {
                    return value.replace("tablet-", "").replace("phone-", "")
                },
                onGet: function(value, options) {
                    return this.model.get("device_format") + "-" + value
                }
            },
            "input[name=name]": {
                observe: "name",
                events: ["blur"]
            },
            "textarea[name=description]": {
                observe: "description",
                events: ["blur"]
            },
            "input[name=refresh-interval]": {
                observe: "refresh_interval",
                events: ["blur"]
            },
            "input[name=daily-frequency-cap]": {
                observe: "daily_impression_cap",
                events: ["blur"],
                onGet: function(val) {
                    var isChecked = this.templateHelpers().isFrequencyCapChecked();
                    if (!isChecked || val === 0) {
                        return ""
                    } else {
                        return val
                    }
                },
                onSet: function(val) {
                    return val === "" ? 0 : val
                }
            },
            "input[name=hourly-frequency-cap]": {
                observe: "hourly_impression_cap",
                events: ["blur"],
                onGet: function(val) {
                    if (val === 0) {
                        return ""
                    } else {
                        return val
                    }
                },
                onSet: function(val) {
                    return val === "" ? 0 : val
                }
            },
            "input[name=landscape]": {
                observe: "landscape",
                onGet: function(val) {
                    return val ? "landscape" : "portrait"
                },
                onSet: function(val) {
                    return val === "landscape"
                }
            },
            "input[name=custom-width]": {
                observe: "custom_width",
                events: ["blur"]
            },
            "input[name=custom-height]": {
                observe: "custom_height",
                events: ["blur"]
            },
            "input[name=adunit-ad_positions-field]": {
                observe: "native_positioning_data",
                events: ["blur"],
                onSet: function(value) {
                    var positioning_data = this.model.get("native_positioning_data");
                    if (_.isEmpty(value)) {
                        if (positioning_data) {
                            delete positioning_data.fixed
                        }
                        return positioning_data
                    }
                    var new_fixed_data = value.split(",").map(function(s) {
                        return s.trim().split(".")
                    }).map(function(arr) {
                        return arr.length < 2 ? ["0"].concat(arr) : arr
                    }).map(function(arr) {
                        return _.object(["section", "position"], arr)
                    }).map(function(obj) {
                        return obj.section === "0" ? {
                            position: obj.position
                        } : obj
                    });
                    return _.extend({}, positioning_data, {
                        fixed: new_fixed_data
                    })
                },
                onGet: function(val) {
                    var data = val["fixed"];
                    if (_.isUndefined(data)) {
                        return ""
                    }
                    return entries = _.chain(data).sort(function(entry1, entry2) {
                        if (entry1.section == entry2.section) {
                            return entry1.position > entry2.position
                        } else {
                            return entry1.section > entry2.section
                        }
                    }).map(function(entry) {
                        if (!_.has(entry, "section")) {
                            return entry.position
                        } else {
                            return entry.section + "." + entry.position
                        }
                    }).value().join(", ")
                }
            },
            "input[name=adunit-repeat_interval-field]": {
                observe: "native_positioning_data",
                events: ["blur"],
                onSet: function(value) {
                    var positioning_data = this.model.get("native_positioning_data");
                    if (!value && _.has(positioning_data, "repeating")) {
                        delete positioning_data.repeating
                    } else {
                        positioning_data.repeating = {
                            interval: value
                        }
                    }
                    return positioning_data
                },
                onGet: function(value) {
                    if (_.has(value, "repeating") && _.has(value.repeating, "interval")) {
                        return value.repeating.interval
                    } else {
                        return ""
                    }
                }
            },
            "input[name=native_video_enabled]": {
                observe: "native_video_enabled",
                events: ["blur"]
            },
            "input[name=rewarded-video-currency-amount]": {
                observe: "rewarded_video_currency_amount",
                events: ["blur"]
            },
            "select[name=rewarded-video-currency]": {
                observe: "rewarded_video_currency",
                selectOptions: {
                    collection: function() {
                        return this.rewardedVideoCurrencyCollection
                    },
                    labelPath: "name",
                    valuePath: "external_key",
                    defaultOption: {
                        label: "Choose a currency",
                        value: null
                    }
                }
            },
            "textarea[name=rewarded_video_callback_url]": {
                observe: "rewarded_video_callback_url",
                events: ["blur"]
            }
        },
        templateHelpers: function() {
            var that = this;
            return {
                PHONE_FORMATS: Publisher.getPhoneFormats(),
                TABLET_FORMATS: Publisher.getTabletFormats(),
                isFrequencyCapChecked: function() {
                    var hourly = that.model.get("hourly_impression_cap"),
                        daily = that.model.get("daily_impression_cap"),
                        isFirstRender = _.isUndefined(that.isFrequencyCapChecked);
                    return isFirstRender ? _.any([hourly, daily]) : that.isFrequencyCapChecked
                },
                isFrequencyDisabled: function(val) {
                    return this.isFrequencyCapChecked() ? "" : "disabled"
                },
                isFormatDisabled: function(format) {
                    return that.app.get("app_type") === "mweb" && (format == "native" || format == "rewarded_video")
                },
                isCreateForm: typeof this.model.id === "undefined"
            }
        },
        onRender: function() {
            Backbone.Validation.bind(this);
            this.stickit();
            if (this.model.hasChanged("format")) {
                this.ui.right_box.addClass("fadeInLeft")
            }
            if (this.model.get("format") === "rewarded_video") {
                $("#rewarded-video-currency-link").click(function() {
                    $("#rewarded-video-currency-link").addClass("hidden");
                    $("#rewarded-video-currency-control-box").removeClass("hidden")
                });
                setupSaveRewardedCurrency("", this.fetchRewardedVideoCurrencyCollection)
            }
        },
        submitHandler: function() {
            return this.save({
                commit: true
            })
        }
    });
    var ErrorFieldsMixin = {
        hasErrors: function() {
            var errors = this.model.validate();
            if (errors) {
                return _.size(this.model.validate()) > 0
            } else {
                return false
            }
        },
        renderModelErrors: function() {
            this.clearModelErrors();
            var that = this,
                prefix = this.prefix,
                errors = this.model.validate();
            if (errors) {
                _(errors).each(function(error, field) {
                    field = field.replace(/\./g, "_");
                    that.$("#" + prefix + "-" + field + "-field").addClass("error");
                    that.$("#" + prefix + "-" + field + "-errors").append(error)
                })
            }
        },
        clearModelErrors: function(prefix) {
            var that = this,
                fields = _.keys(this.model.validation),
                prefix = this.prefix;
            _(fields).each(function(field) {
                field = field.replace(/\./g, "_");
                that.$("#" + prefix + "-" + field + "-field").removeClass("error");
                that.$("#" + prefix + "-" + field + "-errors").empty()
            })
        },
        save: function(options) {
            $("#form-errors").html("");
            var settings = {
                commit: true
            };
            var xhr;
            _.extend(settings, options);
            if (this.model.isValid(true)) {
                if (settings.commit) {
                    var that = this;
                    xhr = this.model.save(null, settings);
                    xhr.done(function() {
                        that.trigger("close")
                    });
                    xhr.fail(function(xhr) {
                        var errorText = "";
                        try {
                            if (xhr.status === 400) {
                                var resp_dict = JSON.parse(xhr.responseText);
                                if (_.isEmpty(resp_dict)) throw "Error response without any errors.";
                                errorText = _.values(resp_dict)[0]
                            } else {
                                throw "Unexpected error"
                            }
                        } catch (err) {
                            errorText = "An error occurred, please verify your settings and try again"
                        }
                        $("#form-errors").html(errorText)
                    })
                }
            } else {
                this.renderModelErrors()
            }
            return xhr
        }
    };
    _.extend(AdUnitForm.prototype, ErrorFieldsMixin);
    _.extend(AppForm.prototype, ErrorFieldsMixin);
    var AppAndAdUnitForm = Backbone.Marionette.Layout.extend({
        template: JST["publisher/app_and_adunit_form"],
        initialize: function(options) {
            var app = new App;
            this.appForm = new AppForm({
                model: app
            });
            this.adUnitForm = new AdUnitForm({
                model: new AdUnit,
                app: app,
                rewardedVideoCurrencyCollection: options.rewardedVideoCurrencyCollection,
                fetchRewardedVideoCurrencyCollection: options.fetchRewardedVideoCurrencyCollection
            })
        },
        regions: {
            appFormContainer: "#app-form-container",
            adUnitFormContainer: "#adunit-form-container"
        },
        renderAdUnitForm: function() {
            this.adUnitForm.render()
        },
        onRender: function() {
            this.appFormContainer.show(this.appForm);
            this.adUnitFormContainer.show(this.adUnitForm)
        },
        submit: function(cb) {
            $("#form-errors").html("");
            this.appForm.save({
                commit: false
            });
            this.adUnitForm.save({
                commit: false
            });
            var app = this.appForm.model;
            var adunit = this.adUnitForm.model;
            app.get("adunits").add(adunit);
            var errors = this.appForm.hasErrors() || this.adUnitForm.hasErrors();
            if (!errors && this.appForm.validateCoppa()) {
                var that = this;
                app.save().done(function(resp) {
                    that.trigger("close", resp)
                }).fail(function(xhr) {
                    var errorText = "";
                    try {
                        if (xhr.status === 400) {
                            var resp_dict = JSON.parse(xhr.responseText);
                            if (_.isEmpty(resp_dict)) {
                                throw "Error response without any errors."
                            } else if (resp_dict.adunits && resp_dict.adunits.length > 0) {
                                errorText = _.values(resp_dict.adunits[0]).join()
                            } else {
                                errorText = _.values(resp_dict).join()
                            }
                        } else {
                            throw "Unexpected error"
                        }
                    } catch (err) {
                        errorText = "An error occurred, please verify your settings and try again"
                    }
                    $("#form-errors").html(errorText)
                })
            }
        }
    });
    _.extend(exports, {
        AppForm: AppForm,
        AdUnitForm: AdUnitForm,
        AppAndAdUnitForm: AppAndAdUnitForm
    })
});
var mopub = mopub || {};
var RedirectConstants = morequire("mopub.utilities.RedirectConstants");
(function($) {
    var LoginController = {
        initialize: function() {
            $("#accountForm-submit").click(function(e) {
                e.preventDefault();
                $("#accountForm").submit()
            });
            $(".formFields input").keypress(function(e) {
                if (e.which == 13) {
                    e.preventDefault();
                    $("#accountForm").submit()
                }
            })
        }
    };
    var RegistrationController = {
        initialize: function() {
            $("#paymentchange-submit").click(function(e) {
                e.preventDefault();
                $("#paymentchange").submit()
            });
            $("input:text").addClass("input-text");
            $("input:password").addClass("input-text");
            var submitFormFn = function() {
                $("#accountForm").submit()
            };
            var submitPubFn = function(newKey) {
                return $.ajax({
                    type: "POST",
                    url: "/web-client/api/account/update-managed-publisher/",
                    contentType: "application/json",
                    data: JSON.stringify({
                        publisher_secret: newKey
                    })
                })
            };
            $("#accountForm-submit").click(function(e) {
                if ($("#id_hidden_email").val() !== $("#id_email").val()) {
                    $("#confirm-password-modal").modal()
                } else {
                    e.preventDefault();
                    var publisherInput = $("#publisher-input-code");
                    var userInputPubSecret = $("#managed-publisher-checkbox").attr("checked");
                    if ($("#publisher-secret").length) {
                        submitFormFn($("#publisher-secret").val()).done(submitFormFn).fail(function(response) {
                            $("#publisher-secret-error-text").text(response.responseText)
                        })
                    } else if (userInputPubSecret) {
                        submitPubFn(publisherInput.val()).done(submitFormFn).fail(function(response) {
                            $("#pub-error-text").text(response.responseText)
                        })
                    } else {
                        submitFormFn()
                    }
                }
            });
            $("#clear-publisher-secret").click(function() {
                $.post("/web_client/api/account/clear-managed-publisher/", {
                    success: function() {
                        window.location.reload()
                    }
                })
            });
            $("#modal-submit").click(function(e) {
                var pw = $("#modal-confirm-password").val();
                $("#id_confirm_password").val(pw);
                e.preventDefault();
                $("#accountForm").submit()
            });
            var $country = $("#id_country");
            var $state = $("#id_state");
            var updateStateSelect = function() {
                if (M($country.val()).in(["US", "CA"])) {
                    $state.removeAttr("disabled")
                } else {
                    $state.val("").attr("disabled", "disabled")
                }
            };
            $country.change(updateStateSelect);
            updateStateSelect();
            $("#id_city").attr("maxlength", 35);
            $("#id_zipcode").attr("maxlength", 10);
            $("#signup-form-submit").click(function(e) {
                e.preventDefault();
                $("#signup-form").submit()
            });
            $(".adForm").each(function() {
                var details = $(this);
                var data = $(".formFields", details);
                var button = $(".adForm-fields-toggleButton", details);
                var infobutton = $(".adForm-fields-infoButton", details);
                var infodialog = $(".accountInfoForm", details);
                var appbutton = $(".adForm-fields-appButton", details);
                var apps = $(".adForm-apps", details);
                data.togglebutton = button;
                data.togglebutton.showText = "Show details";
                data.togglebutton.hideText = "Hide details";
                apps.togglebutton = appbutton;
                apps.togglebutton.showText = "Show apps";
                apps.togglebutton.hideText = "Hide apps";

                function getButtonTextElement(buttonElement) {
                    var buttonTextElement = $(".ui-button-text", buttonElement);
                    if (buttonTextElement.length == 0) buttonTextElement = buttonElement;
                    return buttonTextElement
                }

                function setButtonTextElement(buttonElement, text) {
                    getButtonTextElement(buttonElement).text(text)
                }

                function didShowContainer(container) {
                    container.removeClass("hide");
                    container.addClass("show");
                    setButtonTextElement(container.togglebutton, container.togglebutton.hideText)
                }

                function didHideContainer(container) {
                    container.removeClass("show");
                    container.addClass("hide");
                    setButtonTextElement(container.togglebutton, container.togglebutton.showText)
                }
                if (data.hasClass("show")) {
                    didShowContainer(data)
                } else {
                    data.hide();
                    didHideContainer(data)
                }
                button.click(function(e) {
                    e.preventDefault();
                    if (data.hasClass("show")) {
                        data.slideUp("fast");
                        didHideContainer(data)
                    } else {
                        data.slideDown("fast");
                        didShowContainer(data)
                    }
                });
                infobutton.click(function(e) {
                    e.preventDefault();
                    infodialog.dialog({
                        width: 570,
                        buttons: [{
                            text: "Close",
                            click: function() {
                                $(this).dialog("close")
                            }
                        }]
                    })
                });
                appbutton.click(function(e) {
                    e.preventDefault();
                    if (apps.hasClass("show")) {
                        apps.slideUp("fast");
                        didHideContainer(apps)
                    } else {
                        apps.slideDown("fast");
                        didShowContainer(apps)
                    }
                }).click();
                if (apps.hasClass("show")) {
                    didShowContainer(apps)
                } else {
                    apps.hide();
                    didHideContainer(apps)
                }
            });
            $("#managed-publisher-checkbox").on("change", function(e) {
                var checked = e.target.checked;
                var publisherForm = $(".pub-form");
                var submitButton = $("#accountForm-submit");
                var legalAck = $("#legal-acknowledgement");
                if (checked) {
                    publisherForm.show();
                    submitButton.attr("disabled", true)
                } else {
                    publisherForm.hide();
                    submitButton.attr("disabled", false);
                    legalAck.attr("checked", false)
                }
            });
            $("#legal-acknowledgement").on("change", function(e) {
                var checked = e.target.checked;
                var submitButton = $("#accountForm-submit");
                if (checked) {
                    submitButton.attr("disabled", false)
                } else {
                    submitButton.attr("disabled", true)
                }
            })
        }
    };
    var AccountController = {
        initializePaymentDetails: function(bootstrapping_data) {
            var paypal_required_fields = ["#id_paypal_email"];
            var us_required_fields = ["#id_us_tax_id"];
            var non_us_required_fields = [];
            var wire_required_fields = ["#id_beneficiary_name", "#id_bank_name", "#id_bank_address", "#id_account_number"];
            var us_wire_required_fields = ["#id_ach_routing_number"];
            var non_us_wire_required_fields = ["#id_bank_swift_code"];
            var all_wire_fields = wire_required_fields.concat(us_wire_required_fields).concat(non_us_wire_required_fields);
            if ($("#payment_preference_paypal").is(":checked")) {
                $("#wire_only").hide()
            } else {
                $("#paypal_only").hide()
            }
            $("#payment_preference_paypal").click(function() {
                $("#wire_only").fadeOut(10);
                $("#paypal_only").fadeIn();
                $.each(paypal_required_fields, function(i, field) {
                    $(field).addClass("required")
                });
                $.each(all_wire_fields, function(i, field) {
                    $(field).removeClass("required")
                })
            });
            $("#payment_preference_wire").click(function() {
                $("#paypal_only").fadeOut(10);
                $("#wire_only").fadeIn();
                $.each(paypal_required_fields, function(i, field) {
                    $(field).removeClass("required")
                });
                $.each(wire_required_fields, function(i, field) {
                    $(field).addClass("required")
                });
                if ($("#id_country").val() == "US") {
                    $.each(us_wire_required_fields, function(i, field) {
                        $(field).addClass("required")
                    });
                    $.each(non_us_wire_required_fields, function(i, field) {
                        $(field).removeClass("required")
                    })
                } else {
                    $.each(us_wire_required_fields, function(i, field) {
                        $(field).removeClass("required")
                    });
                    $.each(non_us_wire_required_fields, function(i, field) {
                        $(field).addClass("required")
                    })
                }
            });
            $("#id_country").change(function() {
                if ($("#id_country").val() == "US") {
                    $(".us_only").show();
                    $(".non_us_only").hide();
                    $.each(us_required_fields, function(i, field) {
                        $(field).addClass("required")
                    });
                    $.each(non_us_required_fields, function(i, field) {
                        $(field).removeClass("required")
                    })
                } else {
                    $(".us_only").hide();
                    $(".non_us_only").show();
                    $.each(us_required_fields, function(i, field) {
                        $(field).removeClass("required")
                    });
                    $.each(non_us_required_fields, function(i, field) {
                        $(field).addClass("required")
                    })
                }
                if ($("#payment_preference_paypal").is(":checked")) {
                    $("#payment_preference_paypal").click()
                } else {
                    $("#payment_preference_wire").click()
                }
            }).change();
            $("#paymentchange-submit").click(function(e) {
                e.preventDefault();
                $("#paymentchange").submit()
            })
        },
        initializePaymentInfoPage: function() {
            var PrimaryAdminSettingsView = morequire("mopub.views.accounts.PrimaryAdminSettingsView"),
                PaymentInfoSettingsView = morequire("mopub.views.accounts.PaymentInfoSettingsView");
            if ($("#primary-admin-settings-view").length) {
                new PrimaryAdminSettingsView({
                    el: "#primary-admin-settings-view"
                })
            }
            if ($("#payment-info-settings-view").length) {
                new PaymentInfoSettingsView({
                    el: "#payment-info-settings-view",
                    dataElement: $("#payment-info-bootstrap-data")
                })
            }
        },
        initializeManageUsersView: function() {
            var ManageUsersView = morequire("mopub.views.accounts.ManageUsersView");
            var bootstrapData = $("#manage-users-bootstrap-data");
            if (bootstrapData) {
                new ManageUsersView({
                    el: "#manage-users-view",
                    dataElement: bootstrapData
                }).render()
            }
        }
    };
    $("#account-menu").find("li.account-option").click(function() {
        $.cookie("mopub_account", $(this).data("pk"), {
            path: "/"
        });
        var current_location = _.find(_.keys(RedirectConstants.REDIRECTS_ON_ACCOUNT_SWITCH), function(redirect_location_key) {
            return window.location.pathname.contains(redirect_location_key)
        });
        window.location = RedirectConstants.REDIRECTS_ON_ACCOUNT_SWITCH[current_location] || "/dashboard/"
    });
    AccountController.initializeManageUsersView();
    AccountController.initializePaymentInfoPage();
    window.LoginController = LoginController;
    window.RegistrationController = RegistrationController;
    window.AccountController = AccountController;
    tipaltiHandler = function(evt) {
        if (evt.data && evt.data.TipaltiIframeInfo) {
            if (evt.data.TipaltiIframeInfo.height) jQuery("#tipalti_payment_info_iframe").height(evt.data.TipaltiIframeInfo.height);
            if (evt.data.TipaltiIframeInfo.width) jQuery("#tipalti_payment_info_iframe").width(evt.data.TipaltiIframeInfo.width)
        }
    };
    if (window.addEventListener) window.addEventListener("message", tipaltiHandler, false);
    else window.attachEvent("onmessage", tipaltiHandler)
})(this.jQuery);
momodule("mopub.controllers", function(exports) {
    "use strict";
    var CreativeTableView = morequire("mopub.views.marketplace.CreativeTableView");
    var BlockSelectionView = morequire("mopub.views.marketplace.BlockSelectionView");
    var initializeDomainBlocklist = morequire("mopub.views.marketplace.initializeDomainBlocklist");
    var DspTableView = morequire("mopub.views.marketplace.DspTableView");
    var MarketplaceEducationView = morequire("mopub.views.marketplace.MarketplaceEducationView");
    var TooltipMixin = morequire("mopub.mixins.views.TooltipMixin");
    var DataShim = morequire("mopub.models.data_shim.DataShim");
    var shims = morequire("mopub.models.shim_models");
    var max_retries = 10;
    var toast_error = function() {
        var message = $("Please <a href='#'>refresh the page</a> and try again.").click(function(e) {
            e.preventDefault();
            window.location.reload()
        });
        Toast.error(message, "Error fetching app data.")
    };
    $.tablesorter.addWidget({
        id: "twoLevelSort",
        format: function(table) {
            var adunit_rows = {};
            $(".adunit-row", table).each(function(iter, item) {
                var app_row_id = "#app-" + getAppId(item);
                if (adunit_rows.hasOwnProperty(app_row_id)) {
                    adunit_rows[app_row_id].push(item)
                } else {
                    adunit_rows[app_row_id] = [item]
                }
            });
            _.each(_.keys(adunit_rows), function(app_id) {
                _.each(adunit_rows[app_id].reverse(), function(row) {
                    var app = $(app_id);
                    app.after(row)
                })
            })
        }
    });

    function retryFetch(object, retry_number, callback) {
        if (_.isNull(callback) || _.isUndefined(callback)) {
            callback = function() {}
        }
        if (retry_number > max_retries) {
            toast_error()
        } else {
            object.fetch({
                error: function() {
                    retryFetch(object, retry_number++, callback)
                },
                success: callback
            })
        }
    }

    function fetchAdunitsFromAppKey(app_key, marketplace_active) {
        var adunits = new AdUnitCollection;
        adunits.app_id = app_key;
        adunits.endpoint = "mpx";
        adunits.bind("reset", function(adunits_collection) {
            _.each(adunits_collection.models, function(adunit) {
                adunit.app_id = app_key;
                var adunitView = new AdUnitView({
                    model: adunit,
                    el: "#marketplace_stats"
                });
                adunitView.renderInline()
            })
        });
        adunits.fetch({
            success: function() {
                $("table").trigger("update");
                $("#" + app_key + "-img").hide();
                if (!marketplace_active) {
                    $(".targeting-box").attr("disabled", true)
                }
            },
            error: function() {
                retryFetch(adunits, 0)
            }
        })
    }

    function getAppId(adunit) {
        adunit = $(adunit);
        var app_id = "";
        var adunit_classes = adunit.attr("class").split(" ");
        _.each(adunit_classes, function(adunit_class) {
            if (adunit_class.search("for-app-") >= 0) {
                app_id = adunit_class.replace("for-app-", "")
            }
        });
        return app_id
    }

    function turnOn() {
        var on = $.post("/advertise/marketplace/activation/", {
            activate: "true"
        });
        on.error(function() {
            Toast.error("There was an error saving your Marketplace settings. Our support team has been notified. Please refresh your page and try again.")
        });
        on.done(function() {});
        $(".targeting-box").removeAttr("disabled");
        $("#blindness").removeAttr("disabled");
        return true
    }

    function turnOff() {
        var off = $.post("/advertise/marketplace/activation/", {
            activate: "false"
        });
        $(".targeting-box").attr("disabled", true);
        $("#blindness").attr("disabled", true);
        return true
    }
    exports.MarketplaceController = function(bootstrapping_data) {
        if (!bootstrapping_data.valid_payment_info) {
            (new MarketplaceEducationView).render();
            return
        }
        var pageShim = DataShim(window.DATA_SERVICE_OPTIONS).get_marketplace(bootstrapping_data.campaign_key, bootstrapping_data.adunit_mapping);
        window.MarketplaceGroundControl = {};
        _.extend(window.MarketplaceGroundControl, Backbone.Events);
        var dsp_table = new DspTableView({
            pub_key: bootstrapping_data.pub_key,
            start_date: bootstrapping_data.start_date,
            end_date: bootstrapping_data.end_date
        });
        if ($("#marketplace-dsps-tab").hasClass("active")) {
            dsp_table.render()
        } else {
            $("#marketplace-dsps-tab").one("click", function() {
                dsp_table.render()
            })
        }
        var block_selection = new BlockSelectionView;
        block_selection.render();
        var creative_table = new CreativeTableView({
            start_date: bootstrapping_data.start_date,
            end_date: bootstrapping_data.end_date,
            pub_id: bootstrapping_data.pub_key,
            campaign_key: bootstrapping_data.campaign_key,
            blocked_domains: bootstrapping_data.blocked_domains,
            blocked_creatives: bootstrapping_data.blocked_creatives
        });
        if ($("#marketplace-creative-tab").hasClass("active")) {
            creative_table.render()
        } else {
            $("#marketplace-creative-tab").one("click", function() {
                creative_table.render()
            })
        }
        var domain_picker = initializeDomainBlocklist("#domain_blocklist", bootstrapping_data.blocked_domains);
        domain_picker.render();
        var ShimmedApp = shims.shimmedAppModelFactory(pageShim);
        var apps = new AppCollection;
        apps.bind("loaded", function() {
            var chart_view = new CollectionChartView({
                collection: apps,
                start_date: bootstrapping_data.start_date,
                display_values: ["rev", "imp", "cpm"]
            });
            chart_view.render();
            $("#marketplace-apps .table").tablesorter({
                widgets: ["twoLevelSort"],
                sortList: [
                    [2, 1]
                ],
                headers: {
                    4: {
                        sorter: false
                    },
                    5: {
                        sorter: false
                    },
                    6: {
                        sorter: false
                    },
                    7: {
                        sorter: false
                    }
                },
                sortInitialOrder: "desc"
            });
            set_auto_manage_properties()
        });
        window.fetched_apps = 0;
        _.each(bootstrapping_data.app_keys, function(app_key) {
            var app = new ShimmedApp({
                id: app_key,
                include_daily: true,
                include_adunits: true,
                start_date: bootstrapping_data.start_date,
                date_range: bootstrapping_data.date_range,
                campaign: bootstrapping_data.campaign_key,
                endpoint: "mpx"
            });
            var app_view = new AppView({
                model: app,
                el: "marketplace-apps"
            });
            $("#marketplace-apps .table").stickyTableHeaders();
            app.bind("change", function() {
                app_view.renderInline();
                if (!bootstrapping_data.marketplace_active) {
                    $(".targeting-box").attr("disabled", true)
                }
            });
            var finished_loading_callback = function() {
                window.fetched_apps++;
                if (window.fetched_apps >= apps.length) {
                    apps.trigger("loaded")
                }
            };
            app.fetch({
                error: function() {
                    retryFetch(app, 0, finished_loading_callback)
                },
                success: finished_loading_callback
            });
            apps.add(app)
        });
        var URL = "/advertise/marketplace/dsp_whitelist/";
        mopub.Selectors.initializeDspWhitelist(URL, bootstrapping_data.DSP_OPTIONS);
        $(".chosen-select").chosen({
            no_results_text: "No DSPs matched",
            width: "350px"
        });
        $("#blindness").click(function() {
            var blindness_xhr = $.post("/advertise/marketplace/settings/blindness/", {
                activate: $(this).is(":checked")
            })
        });
        $("#private-keywords").click(function() {
            var private_keywords_xhr = $.post("/advertise/marketplace/settings/private_keywords/", {
                activate: $(this).is(":checked")
            })
        });
        $("li").has("#marketplace-settings").click(function() {
            $(".datepicker-controls").hide()
        });
        $("li").has("#marketplace-performance, #marketplace-controls").click(function() {
            $(".datepicker-controls").show()
        });
        $(".mpx-activation").click(function() {
            $(".mpx-activation").removeAttr("checked");
            $(this).attr("checked", "checked")
        });
        $("#activation-on").click(turnOn);
        $("#activation-off").click(turnOff);
        $("#turn-on-anchor").click(function() {
            $("#marketplace-settings").click();
            _.defer(function() {
                $("body").scrollTop(1e7)
            })
        });
        TooltipMixin.hoverablePopover($("[data-marketplace-disabled] .targeting div.popover-target"), {
            delay: 200,
            animation: true,
            placement: "left",
            container: "body",
            title: "MoPub Marketplace Native Ads",
            content: 'Native ads from MoPub Marketplace are not currently enabled for your account. Please contact <a href="mailto:nativeads@twitter.com">nativeads@twitter.com</a> to request access. Note that you can still run native ad campaigns with direct ad partners.'
        });

        function post_categories(filter_level, categories, attributes) {
            var loading_img = $("#filter-spinner").show();
            var saving = $("#filter-save-status .saving").show();
            var result = $.post("/advertise/marketplace/settings/content_filter/", {
                filter_level: filter_level,
                categories: categories,
                attributes: attributes
            });
            result.success(function(data) {
                loading_img.hide();
                saving.hide();
                if (data.hasOwnProperty("success")) {
                    var saved = $("#filter-save-status .saved").show();
                    setTimeout(function() {
                        saved.fadeOut()
                    }, 1e3)
                } else {
                    var errored = $("#filter-save-status .error").show();
                    setTimeout(function() {
                        errored.fadeOut()
                    }, 1e3)
                }
            })
        }
        $(".content_level").click(function() {
            var filter_level = $(this).val();
            var categories = [];
            var attributes = [];
            if (filter_level === "custom") {
                $("#categories_div").show();
                categories = $("#categories").val();
                attributes = $("#attributes").val()
            } else {
                $("#categories_div").hide();
                var customCategoryBlocks = $("#custom_category_blocks");
                if (customCategoryBlocks.data("allow-hide")) {
                    customCategoryBlocks.hide()
                }
            }
            post_categories(filter_level, categories, attributes)
        });
        window.marketplaceSettingsHelpers.listenToVideoSettings();
        $("#categories").chosen({
            no_results_text: "No results matched",
            width: "350px"
        }).change(function() {
            var categories = $(this).val();
            post_categories("custom", categories, $("#attributes").val())
        });
        $("#attributes").chosen({
            no_results_text: "No results matched",
            width: "350px"
        }).change(function() {
            var attributes = $(this).val();
            post_categories("custom", $("#categories").val(), attributes)
        });
        var compute_all_over_adunits = function(apps, property) {
            return apps.all(function(app) {
                return app.get("adunit_collection").all(function(adunit) {
                    return adunit.get(property)
                })
            })
        };
        var sync_checkboxes = function(apps) {
            var all_managed = compute_all_over_adunits(apps, "spf_auto_manage");
            $("#auto-manage-all").prop("checked", all_managed)
        };
        var set_auto_manage_properties = function() {
            $("#auto-manage-all").prop("disabled", false);
            sync_checkboxes(apps);
            $(".spf_auto_manage input").change(function() {
                sync_checkboxes(apps)
            });
            $("#auto-manage-all").click(function() {
                var manage_all = $(this).is(":checked");
                $(".spf_auto_manage input").each(function(idx, element) {
                    if ($(element).prop("checked") !== manage_all) {
                        $(element).prop("checked", manage_all).trigger("change")
                    }
                })
            })
        }
    }
});
momodule("mopub.controllers.creative_modal", function(exports) {
    jQuery.event.props.push("dataTransfer");
    var CreativeModal = function($el) {
        var $formTab = $el.find(".native-form");
        var $codeTab = $el.find(".native-code");
        var $formButton = $el.find('input[name="native-input-type"][value="form"]');
        var $codeButton = $el.find('input[name="native-input-type"][value="code"]');
        this.$el = $el;
        this.formTab = new CreativeModalTab($formTab, $formButton);
        this.codeTab = new CreativeModalTab($codeTab, $codeButton);
        this.tabs = [this.formTab, this.codeTab]
    };
    CreativeModal.dataKey = "creativeModal";
    CreativeModal.prototype = {
        currentTab: function() {
            return _.find(this.tabs, function(tab) {
                return tab.isActive()
            })
        },
        defaultTab: function() {
            return _.find(this.tabs, function(tab) {
                return tab.isDefault()
            })
        },
        isFormTab: function() {
            return this.currentTab() == this.formTab
        },
        isCodeTab: function() {
            return this.currentTab() == this.codeTab
        },
        isNewCreative: function() {
            return !!$(this.$el).parents("#new_creative_form_modal").length
        },
        setVideoFieldsEnabled: function(enabled) {
            this.formTab.setVideoFieldsEnabled(enabled)
        }
    };
    var CreativeModalTab = function($el, $tabTrigger) {
        this.$el = $el;
        this.fields = [];
        this.$tabTrigger = $tabTrigger;
        this.name = $tabTrigger.val()
    };
    CreativeModalTab.prototype = {
        show: function() {
            this.$tabTrigger.prop("checked", true).tab("show")
        },
        isDefault: function() {
            return this.$tabTrigger.is("[defaultChecked]")
        },
        isActive: function() {
            return this.$el.hasClass("active")
        },
        textFieldContainer: function() {
            return this.$el.find(".dynamic-field-container")
        },
        imageFieldContainer: function() {
            return this.$el.find(".dynamic-image-container")
        },
        addField: function(field) {
            var fieldView = new DynamicFieldView({
                model: field,
                tab: this
            });
            if (field.get("isImage") || field.get("isVideo")) {
                this.imageFieldContainer().append(fieldView.$el)
            } else {
                this.textFieldContainer().append(fieldView.$el)
            }
            this.fields.push(field);
            if (field.get("presentClicked")) {
                fieldView.editKey()
            }
            return fieldView
        },
        removeField: function(field) {
            this.fields = _.reject(this.fields, function(el) {
                return el.cid == field.cid
            })
        },
        toJSON: function() {
            var jsonData = {};
            _.each(this.fields, function(field) {
                var value = field.get("value"),
                    key = field.get("key"),
                    isInactive = field.get("isInactive");
                if (!isInactive && value && value !== "" && key && key !== "") {
                    jsonData[key] = field.get("isImage") ? value.url : value
                }
            });
            return jsonData
        },
        imageIDs: function() {
            return _.chain(this.fields).map(function(field) {
                if (field.get("isImage") && field.get("value")) return field.get("value").id
            }).compact().value()
        },
        setVideoFieldsEnabled: function(enabled) {
            _.each(this.fields, function(field) {
                if (field.get("isVideo")) {
                    field.set("isInactive", !enabled)
                }
            })
        }
    };
    var DynamicField = Backbone.Model.extend({
        defaults: {
            canRemoveValue: true,
            isInactive: false,
            isRequired: false,
            keyError: false,
            isImage: false,
            isVideo: false,
            keyLabel: null,
            hasLabel: true,
            value: null,
            key: ""
        }
    });
    var DynamicFieldView = Backbone.View.extend({
        initialize: function() {
            this.model.view = this;
            this.model.on("change", function() {
                this.render()
            }, this);
            this.render()
        },
        events: {
            "click label": "editKey",
            "keydown .edit-in-place-input": "updateKey",
            "blur .edit-in-place-input": "updateKey",
            "click .remove-field": "removeView",
            "click .remove-value": "removeValue",
            "change .controls input": "updateValue",
            "keyup .controls input": "updateValue",
            "textInput .controls input": "updateValue",
            "blur .controls input": "updateValue",
            "change .controls .image-fileselect": "fileSelectHandler",
            "mouseenter .fileselect": "addInputHover",
            "mouseleave .fileselect": "removeInputHover",
            "change .controls textarea": "updateValueFromXmlTextarea",
            "keyup .controls textarea": "updateValueFromXmlTextarea",
            "textInput .controls textarea": "updateValueFromXmlTextarea",
            "blur .controls textarea": "validateXmlTextarea"
        },
        render: function(cModel) {
            var template, changed = cModel ? cModel.changed : {};
            var variables = {
                label: _.escape(this.model.get("keyLabel") || this.model.get("key")),
                isImageUploading: this.model.get("isImageUploading"),
                canRemoveValue: this.model.get("canRemoveValue"),
                requiredField: this.model.get("isRequired"),
                hasLabel: this.model.get("hasLabel"),
                keyError: this.model.get("keyError"),
                valueError: this.model.get("valueError"),
                value: this.model.get("value"),
                valueLabel: null
            };
            var isImage = this.model.get("isImage"),
                isVideo = this.model.get("isVideo"),
                value = this.model.get("value");
            if (isImage) {
                if (value) {
                    variables.valueLabel = this.buildImageValueLabel()
                }
                template = _.template($("#image_template").html())(variables)
            } else if (isVideo) {
                template = _.template($("#video_template").html())(variables)
            } else {
                template = _.template($("#field_template").html())(variables)
            }
            this.$el.html(template);
            if ("isImageUploading" in changed && changed.isImageUploading === false) {
                var oldLabelInput = this.$el.find(".edit-in-place-input").val();
                this.$el.find(".edit-in-place-input").val(oldLabelInput)
            }
            if (isImage && value) {
                this.addPopover()
            }
            this.$label = this.$el.find("label");
            this.$labelInput = this.$el.find(".edit-in-place-input");
            this.$valueInput = this.$el.find(".controls input");
            this.$errorText = this.$el.find(".help-block");
            this.$el.toggle(!this.model.get("isInactive"))
        },
        editKey: function() {
            if (this.model.get("isRequired")) {
                return
            }
            this.$label.hide();
            this.$labelInput.val(this.model.get("key")).show().focus()
        },
        updateKey: function(e) {
            if (e && e.type === "keydown" && e.keyCode !== 13 && e.keyCode !== 9) {
                return
            }
            var newKey = this.$labelInput.val(),
                modal = CMHelper.currentModal(this.$el);
            var keyError = CreativeModalController.keyNameError(modal, this.model, newKey);
            this.model.set({
                keyLabel: newKey,
                key: newKey,
                keyError: keyError
            });
            if (e && e.type === "keydown") {
                e.preventDefault();
                this.$valueInput.focus()
            }
        },
        updateValue: function(e) {
            var model = this.model;
            if (!model.get("isImage")) {
                var value = this.$valueInput.val();
                model.set("value", value, {
                    silent: true
                })
            }
        },
        updateValueFromXmlTextarea: function(e) {
            var model = this.model;
            var value = this.$el.find(".controls textarea").val();
            model.set("value", value, {
                silent: true
            })
        },
        validateXmlTextarea: function(e) {
            var model = this.model;
            var value = this.$el.find(".controls textarea").val();
            var xmlError = false;
            var xml;
            try {
                xml = $.parseXML(value)
            } catch (e) {
                xml = null
            }
            if (!xml) {
                xmlError = "This field must contain a valid XML document."
            }
            model.set("valueError", xmlError)
        },
        fileSelectHandler: function(e) {
            var model = this.model,
                fieldView = this;
            model.set({
                isImageUploading: true
            });
            mopub.Utils.fileUploadHandler(e, "/advertise/creatives/images/").done(function(image) {
                model.set({
                    value: image,
                    isImageUploading: false,
                    valueError: false
                });
                fieldView.editKey()
            }).fail(function(errors) {
                model.set({
                    value: null,
                    isImageUploading: false,
                    valueError: errors.errors
                })
            })
        },
        removeValue: function() {
            this.model.set("value", null)
        },
        removeView: function() {
            var modal = CMHelper.currentModal(this.$el);
            modal.currentTab().removeField(this.model);
            this.$el.fadeOut(300, function() {
                $(this).remove()
            })
        },
        buildImageValueLabel: function() {
            var buildLabel = function(image) {
                return image.name + " (" + image.height + "x" + image.width + " " + (image.size / 1e3).toFixed(1) + " KB)"
            };
            var image = this.model.get("value"),
                imageDescription = buildLabel(image),
                maxLength = this.model.get("hasLabel") ? 37 : 67,
                overflow = imageDescription.length - maxLength;
            if (overflow > 0) {
                image.name = image.name.slice(0, -overflow) + "...";
                imageDescription = buildLabel(image)
            }
            return imageDescription
        },
        addPopover: function() {
            if (!this.model.get("isImage")) {
                return false
            }
            var $target = this.$el.find(".controls a").first(),
                image = this.model.get("value");
            CMHelper.buildPopover($target, image.url, image.height, image.width)
        },
        addInputHover: function() {
            this.$el.find(".re-upload a").addClass("hover")
        },
        removeInputHover: function() {
            this.$el.find(".re-upload a").removeClass("hover")
        }
    });
    var CreativeModalController = {
        initialize: function() {
            var self = this;
            $('input[name="native-input-type"]').on("change", function(e) {
                $(this).tab("show")
            });
            $("fieldset.creative_form").each(function() {
                var modal = new CreativeModal($(this));
                if (modal.defaultTab()) modal.defaultTab().show();
                $(this).data(CreativeModal.dataKey, modal)
            });
            $(".add-dynamic").on("click", function(e) {
                e.preventDefault();
                var modal = CMHelper.currentModal(this),
                    args = {
                        key: "",
                        value: null,
                        isImage: false,
                        presentClicked: true
                    };
                modal.currentTab().addField(new DynamicField(args))
            });
            $("#new_creative_form_modal").on("hidden", function(e) {
                if (e.target !== this) {
                    return
                }
                var $newCreativeForm = $(this).find("form"),
                    modal = CMHelper.currentModal($newCreativeForm);
                $newCreativeForm.get(0).reset();
                modal.defaultTab().show();
                OrdersController.initializeCreativeFormFields()
            });
            $(".image-upload input").on("change", function(e) {
                var modal = CMHelper.currentModal(this);
                var imageField = new DynamicField({
                    isImage: true,
                    hasLabel: modal.isFormTab(),
                    canRemoveValue: modal.isFormTab(),
                    presentClicked: true
                });
                var imageFieldView = modal.currentTab().addField(imageField);
                imageFieldView.updateValue(e);
                imageFieldView.fileSelectHandler(e);
                $(this).replaceWith($(this).val("").clone(true))
            });
            $(".bootstrap_data").each(function() {
                var bootstrapDataRaw = $(this).text().trim() || "{}",
                    bootstrapData = JSON.parse(bootstrapDataRaw),
                    modal = CMHelper.currentModal(this);
                if (modal.isFormTab()) {
                    self.addFormTabFields(modal, bootstrapData)
                } else {
                    self.addCodeTabFields(modal, bootstrapData)
                }
            });
            $(".fileselect").on("mouseenter", function() {
                $(this).siblings("a").addClass("hover")
            });
            $(".fileselect").on("mouseleave", function() {
                $(this).siblings("a").removeClass("hover")
            })
        },
        addFormTabFields: function(modal, bootstrapData) {
            this.addRequiredFields(modal.formTab, bootstrapData);
            _.chain(bootstrapData.json_data).omit(reservedKeys.names).each(function(value, key) {
                var args = {
                    value: value,
                    key: key,
                    keyLabel: key
                };
                if (key.match(/image$/gi)) {
                    var imageObject = CMHelper.getImageByURL(value, bootstrapData.images);
                    if (imageObject) {
                        args.value = imageObject;
                        args.isImage = true
                    }
                }
                var field = new DynamicField(args);
                modal.formTab.addField(field)
            })
        },
        addCodeTabFields: function(modal, bootstrapData) {
            this.addRequiredFields(modal.formTab, {});
            _.each(bootstrapData.images, function(image) {
                var imageField = new DynamicField({
                    value: image,
                    isImage: true,
                    hasLabel: false,
                    canRemoveValue: false
                });
                modal.codeTab.addField(imageField)
            });
            if (!_.isEmpty(bootstrapData.json_data)) {
                var $textarea = modal.codeTab.$el.find(".raw_json_field textarea"),
                    prettyJson = JSON.stringify(bootstrapData.json_data, null, "\t");
                $textarea.val(prettyJson)
            }
        },
        addRequiredFields: function(tab, bootstrapData) {
            var json_data = bootstrapData.json_data || {},
                images = bootstrapData.images || {};
            _.each(reservedKeys.names, function(reservedKey) {
                var args = {
                    isRequired: true,
                    key: reservedKey,
                    keyLabel: reservedKeys.prettyName(reservedKey),
                    value: json_data[reservedKey]
                };
                if (reservedKey.match(/image$/gi)) {
                    args.isImage = true;
                    if (args.value) {
                        args.value = CMHelper.getImageByURL(args.value, images)
                    }
                } else if (reservedKey === "video") {
                    if (!mopub.gargoyle.isSwitchEnabled("native_video")) {
                        return
                    }
                    args.isVideo = true
                }
                var requiredField = new DynamicField(args);
                tab.addField(requiredField)
            })
        },
        keyNameError: function(modal, currentField, keyName) {
            var keys = _.chain(modal.currentTab().fields).reject(function(field) {
                return field == currentField
            }).map(function(field) {
                return field.get("key").toLowerCase()
            }).value();
            keyName = keyName.toLowerCase();
            if (keyName === "") {
                return "Key name cannot be blank."
            }
            if (currentField.get("isImage") && !keyName.match(/image$/)) {
                return "Image field key names must end in 'image'."
            }
            if (_.contains(reservedKeys.names, keyName)) {
                return "This key name is reserved."
            }
            if (_.contains(keys, keyName)) {
                return "This key name is already used."
            }
            return false
        },
        prepareCreativeFrom: function(modal) {
            var $madeWithForm = $("<input type='hidden' name='created_with_form'></input>"),
                $fileIds = $("<input name='file_ids' type='hidden'></input>"),
                jsonDataString = null;
            if (modal.isFormTab()) {
                jsonDataString = JSON.stringify(modal.formTab.toJSON());
                modal.$el.find(".raw_json_field textarea").val(jsonDataString);
                $madeWithForm.val("true")
            } else {
                $madeWithForm.val("false")
            }
            _.each(["url", "launchpage", "tracking_url"], function(name) {
                var $input = modal.$el.find('[name="' + name + '"]');
                $input.val($input.val().trim())
            });
            $fileIds.val(JSON.stringify({
                files: modal.currentTab().imageIDs()
            }));
            modal.$el.append($fileIds).append($madeWithForm)
        },
        handleNativeFormSubmit: function(form) {
            var modal = CMHelper.currentModal(form);
            var originalFormName = modal.defaultTab().name == "form" ? "Easy Form" : "Manual JSON";
            this.prepareCreativeFrom(modal);
            if (modal.isCodeTab()) {
                var $codeBox = modal.$el.find(".raw_json_field textarea");
                try {
                    JSON.parse($codeBox.val());
                    modal.$el.find(".invalid-json").hide();
                    $codeBox.removeClass("error")
                } catch (e) {
                    $codeBox.addClass("error");
                    modal.$el.find(".invalid-json").show();
                    return false
                }
            }
            _.each(modal.formTab.fields, function(f) {
                if (f.get("isVideo") && !f.get("isInactive")) {
                    f.view.validateXmlTextarea()
                }
            });
            var keyErrors = _.map(modal.formTab.fields, function(f) {
                return f.get("isInactive") ? null : f.get("keyError")
            });
            var valueErrors = _.map(modal.formTab.fields, function(f) {
                return f.get("isInactive") ? null : f.get("valueError")
            });
            if (modal.isFormTab() && (_.any(keyErrors) || _.any(valueErrors))) {
                return false
            } else if (modal.isNewCreative() || modal.currentTab() == modal.defaultTab()) {
                return true
            } else {
                return confirm("You may be losing unsaved data in the " + originalFormName + " tab, are you sure you'd like to continue?")
            }
        },
        setVideoFieldsEnabled: function(form, enabled) {
            var modal = CMHelper.currentModal(form);
            modal.setVideoFieldsEnabled(enabled)
        }
    };
    var CMHelper = {
        getImageByURL: function(url, images) {
            return _.find(images, function(image) {
                return image.url == url
            })
        },
        currentModal: function(elm) {
            if ($(elm).is("form")) {
                return $(elm).find("fieldset.creative_form").data(CreativeModal.dataKey)
            } else {
                return $(elm).parents("fieldset.creative_form").andSelf().filter("fieldset.creative_form").data(CreativeModal.dataKey)
            }
        },
        removeProtocol: function(url) {
            return url.replace(/^https{0,1}:/, "")
        },
        buildPopover: function($target, url, height, width) {
            height = parseInt(height);
            width = parseInt(width);
            var aspect = height / width,
                MAX_HEIGHT = 350,
                MAX_WIDTH = 400;
            if (aspect < 1) {
                width = Math.min(width, MAX_WIDTH);
                height = width * aspect
            } else {
                height = Math.min(height, MAX_HEIGHT);
                width = height / aspect
            }
            popoverStyle = "" + "height: " + height + "px;" + "width: " + width + "px;" + "background: url('" + this.removeProtocol(url) + "') no-repeat top left;" + "background-size: contain;";
            $target.popover({
                html: true,
                content: '<div style="' + popoverStyle + '"></div>',
                trigger: "hover",
                placement: "top",
                container: "body"
            })
        }
    };
    var reservedKeys = function() {
        var reservedKeysMap = {
            title: "Title",
            text: "Text",
            ctatext: "CTA Text",
            iconimage: "Icon Image",
            mainimage: "Main Image",
            video: "Video"
        };
        return {
            prettyName: function(keyName) {
                return reservedKeysMap[keyName]
            },
            names: _.keys(reservedKeysMap)
        }
    }();
    _.extend(exports, {
        CreativeModal: CreativeModal,
        CreativeModalTab: CreativeModalTab,
        CreativeModalController: CreativeModalController,
        DynamicField: DynamicField,
        DynamicFieldView: DynamicFieldView,
        CMHelper: CMHelper
    })
});
(function() {
    "use strict";
    var CreativeTableView = morequire("mopub.views.marketplace.CreativeTableView");
    var BlockSelectionView = morequire("mopub.views.marketplace.BlockSelectionView");
    var initializeDomainBlocklist = morequire("mopub.views.marketplace.initializeDomainBlocklist");
    var Domain = morequire("mopub.models.Domain");
    var DomainCollection = morequire("mopub.models.DomainCollection");
    var parseDomains = morequire("mopub.models.parseDomains");
    var PickerView = morequire("mopub.views.components.PickerView");
    var CreativeModal = morequire("mopub.controllers.creative_modal");
    var TooltipMixin = morequire("mopub.mixins.views.TooltipMixin");
    var DataShim = morequire("mopub.models.data_shim.DataShim");
    var shims = morequire("mopub.models.shim_models");
    var Constants = morequire("mopub.utilities.Constants");
    var CANADA_CODE_TO_PROVINCE = {
        "01": "AB",
        "02": "BC",
        "03": "MB",
        "04": "NB",
        "05": "NL",
        "07": "NS",
        13: "NT",
        14: "NU",
        "08": "ON",
        "09": "PE",
        10: "QC",
        11: "SK",
        12: "YT"
    };

    function renderOrder(order, render_line_items) {
        if (_.isUndefined(render_line_items)) {
            render_line_items = true
        }
        var order_view = new OrderView({
            model: order,
            el: "inventory_table"
        });
        order_view.renderInline();
        if (render_line_items) {
            var line_items = new AdGroupCollection(order.get("adgroups"));
            line_items.each(function(line_item) {
                _.defer(renderLineItem, line_item, false)
            })
        }
    }

    function renderLineItem(line_item, render_creatives) {
        if (typeof render_creatives === "undefined") {
            render_creatives = true
        }
        var line_item_view = new LineItemView({
            model: line_item,
            el: "inventory_table"
        });
        line_item_view.renderInline();
        if (render_creatives) {
            var creatives = new CreativeCollection(line_item.get("creatives"));
            creatives.each(function(creative) {
                renderCreative(creative)
            })
        }
    }

    function renderCreative(creative) {
        var creative_view = new CreativeView({
            model: creative,
            el: "inventory_table"
        });
        creative_view.renderInline()
    }

    function renderApp(app) {
        var app_view = new AppView({
            model: app,
            el: "inventory_table"
        });
        app_view.renderInline()
    }

    function renderAdUnit(adunit) {
        var adunit_view = new AdUnitView({
            model: adunit,
            el: "inventory_table"
        });
        adunit_view.renderInline()
    }
    window.orderHelpers = {
        updateStatusRow: function(key, status) {
            var $status_img = $("#status-" + key);
            var $affected_row = $("#" + key);
            var $tds = $affected_row.find("> td");
            if ($status_img.attr("class")) {
                _.each($status_img.attr("class").split(/\s+/), function(cls) {
                    if (cls.search("sprite") >= 0) {
                        $status_img.removeClass(cls)
                    }
                })
            }
            $status_img.addClass("sprite-" + status);
            if (status == "running") {
                $tds.fadeTo(500, 1);
                $affected_row.addClass("running").removeClass("archived").removeClass("paused")
            } else if (status == "paused" | status == "paused-inactive" | status == "running-inactive") {
                $tds.fadeTo(500, 1);
                $affected_row.addClass("paused").removeClass("archived").removeClass("running")
            } else if (status == "scheduled" || status == "scheduled-inactive") {
                $tds.fadeTo(500, 1);
                $affected_row.addClass("scheduled").removeClass("archived running paused")
            } else if (status == "archived") {
                $affected_row.addClass("archived").removeClass("running").removeClass("paused");
                $tds.fadeTo(500, .4)
            } else if (status == "deleted") {
                $tds.fadeTo(500, .4)
            }
        }
    };

    function changeStatus(ad_sources, status) {
        _.each(ad_sources, function(ad_source) {
            $("#" + ad_source + "-img").removeClass("hidden").show()
        });
        var promise = $.ajax({
            url: "/advertise/ad_source/status/",
            type: "POST",
            data: {
                ad_sources: ad_sources,
                status: status
            },
            cache: false,
            dataType: "json",
            success: function(data, text_status, xhr) {
                if (data.success) {
                    _.each(data.affected, function(affected) {
                        $("#" + affected.external_key + "-img").hide();
                        orderHelpers.updateStatusRow(affected.external_key, affected.newStatus)
                    });
                    _.each(ad_sources, function(ad_source) {
                        var status = data.newStatus[ad_source];
                        $("#" + ad_source + "-img").hide();
                        orderHelpers.updateStatusRow(ad_source, status)
                    })
                } else {
                    _.each(ad_sources, function(ad_source) {
                        $("#" + ad_source + "-img").addClass("hidden")
                    })
                }
            },
            error: function(data, text_status, xhr) {
                _.each(ad_sources, function(ad_source) {
                    $("#" + ad_source + "-img").addClass("hidden")
                })
            }
        })
    }

    function copyLineItem(line_item_key, order_key, with_creatives) {
        var error_message = "MoPub experienced an error " + "trying to copy your line item. " + "We apologize for this inconvenience. " + "If this error persists, please contact " + "support@mopub.com";
        $("#copy-button").addClass("disabled");
        var copy_promise = $.ajax({
            url: "/advertise/line_item_copy/",
            type: "post",
            data: {
                order: order_key,
                line_item: line_item_key,
                copy_creatives: with_creatives
            }
        });
        copy_promise.success(function(response) {
            if (response.success) {
                var message = "Your line item was successfully copied." + "You can see your new line item <a href='" + response.url + "'>here</a>.";
                Toast.success(message)
            } else {
                Toast.error(error_message)
            }
        });
        copy_promise.error(function() {
            Toast.error(error_message)
        });
        copy_promise.always(function() {
            $("#copy-button").removeClass("disabled")
        });
        return copy_promise
    }

    function initializeBudgetControls(line_item_key) {
        $("#update-budget").click(function() {
            var use_staging = $("#use_staging").is(":checked");
            var budget_promise = $.ajax({
                url: "/advertise/push_budget/",
                data: {
                    adgroup_key: line_item_key,
                    staging: use_staging ? 1 : 0
                }
            });
            budget_promise.success(function(response) {
                Toast.info(response.status);
                $("#budget-admin-modal").modal("hide")
            });
            budget_promise.error(function(response) {
                Toast.error("Couldn't access the push endpoint")
            })
        })
    }
    var toggleStatusChangeControls = function() {
        var checked_adgroups = $(".status_change_control:checked");
        if (checked_adgroups.length === 0) {
            $(".status_change.btn").addClass("disabled").attr("disabled", "disabled")
        } else {
            $(".status_change.btn").removeClass("disabled").removeAttr("disabled")
        }
    };

    function initializeStatusControls(keep_checked) {
        if (typeof keep_checked === "undefined") {
            keep_checked = false
        }
        $(".status_change_control").change(function(e) {
            toggleStatusChangeControls()
        });
        $(".status_change.btn").click(function(e) {
            e.preventDefault();
            var table_selector = $(this).attr("data-target");
            var status = $(this).attr("data-toggle");
            if (typeof table_selector === "undefined") {
                throw Error("Status change button's data-target attribute " + "cannot be undefined")
            }
            if (typeof status === "undefined") {
                throw Error("Status change button's data-toggle " + "attribute cannot be undefined")
            }
            var checked_adgroups = $(".status_change_control:checked", $(table_selector));
            var keys = _.map(checked_adgroups, function(row) {
                return $(row).attr("id")
            });
            changeStatus(keys, status);
            if (!keep_checked) {
                $(".status_change_control").each(function() {
                    $(this).attr("checked", false);
                    toggleStatusChangeControls()
                })
            }
        })
    }

    function add_options($element, options) {
        for (var index in options) {
            var value = options[index][0];
            if (!$('option[value="' + value + '"]', $element).length) {
                $element.append($("<option />", {
                    value: value,
                    html: options[index][1]
                }))
            }
        }
    }

    function remove_options($element, options) {
        for (var index in options) {
            var value = options[index][0];
            $('option[value="' + value + '"]', $element).remove()
        }
    }

    function initializeAdvertiserTypeAhead(advertisers, company) {
        $("#id_order-advertiser, #id_advertiser").typeahead({
            source: advertisers
        })
    }
    var OrdersControllerCustom = {
        initializeIndex: function(bootstrapping_data) {
            var pageShim = DataShim(window.DATA_SERVICE_OPTIONS).get_order_index_shim(bootstrapping_data.line_item_mapping);
            var orders_table = new Filters.FilteredTableView({
                el: "#orders-filtered-table",
                button_el: "#orders-filter-buttons-placeholder",
                filter_groups: Filters.OrderFilterGroups
            });
            orders_table.render();
            $("#order_table").stickyTableHeaders();
            var line_items_table = new Filters.FilteredTableView({
                el: "#line-items-filtered-table",
                button_el: "#line-items-filter-buttons-placeholder",
                filter_groups: Filters.getLineItemFilterGroups()
            });
            line_items_table.render();
            $("#line_item_table").stickyTableHeaders();
            initializeStatusControls();
            var rendered_orders = 0;
            var ShimmedCampaign = shims.shimmedCampaignModelFactory(pageShim);
            _.each(bootstrapping_data.order_keys, function(order_key) {
                var order = new ShimmedCampaign({
                    id: order_key,
                    include_adgroups: true,
                    start_date: bootstrapping_data.start_date,
                    date_range: bootstrapping_data.date_range
                });
                order.bind("change", function() {
                    renderOrder(order, true);
                    rendered_orders++;
                    if (rendered_orders === bootstrapping_data.order_keys.length) {
                        $("#order_table").tablesorter({
                            headers: {
                                1: {
                                    sorter: "status",
                                    sortInitialOrder: "asc"
                                }
                            },
                            sortList: [
                                [5, 1]
                            ],
                            sortInitialOrder: "desc"
                        });
                        _.defer(function() {
                            $("#line_item_table").tablesorter({
                                sortList: [
                                    [4, 0]
                                ],
                                sortInitialOrder: "desc",
                                headers: {
                                    1: {
                                        sorter: "status",
                                        sortInitialOrder: "asc"
                                    },
                                    5: {
                                        sorter: "goals"
                                    },
                                    13: {
                                        sorter: false
                                    }
                                }
                            })
                        })
                    }
                });
                order.fetch()
            });
            this.setIndexHandlers()
        },
        initializeArchiveIndex: function(bootstrapping_data) {
            var pageShim = DataShim(window.DATA_SERVICE_OPTIONS).get_archive_index(bootstrapping_data.line_item_keys, bootstrapping_data.line_item_map);
            initializeStatusControls();
            var ShimmedCampaign = shims.shimmedCampaignModelFactory(pageShim);
            var ShimmedAdGroup = shims.shimmedAdGroupModelFactory(pageShim);
            _.each(bootstrapping_data.order_keys, function(order_key) {
                var order = new ShimmedCampaign({
                    id: order_key,
                    include_adgroups: true,
                    start_date: bootstrapping_data.start_date,
                    date_range: bootstrapping_data.date_range
                });
                order.bind("change", function() {
                    renderOrder(order, false)
                });
                order.fetch()
            });
            _.each(bootstrapping_data.line_item_keys, function(li_key) {
                var line_item = new ShimmedAdGroup({
                    id: li_key,
                    include_creatives: false,
                    start_date: bootstrapping_data.start_date,
                    date_range: bootstrapping_data.date_range
                });
                line_item.bind("change", function() {
                    renderLineItem(line_item, false)
                });
                line_item.fetch()
            });
            $("#delete-button").click(function(event) {
                event.preventDefault();
                var checked_adgroups = $(".status_change_control:checked");
                var keys = _.map(checked_adgroups, function(row) {
                    return $(row).attr("id")
                });
                $("#confirm_delete_modal").modal("show");
                $("#confirm_delete_button").click(function() {
                    changeStatus(keys, "delete");
                    $("#confirm_delete_modal").modal("hide")
                })
            });
            this.setIndexHandlers()
        },
        setIndexHandlers: function() {
            $("ul.tabs, ul.tab-links").click(function() {
                $(".status_change_control").each(function() {
                    $(this).attr("checked", false);
                    toggleStatusChangeControls()
                })
            });
            $("#order-quick-navigate").chosen().change(function() {
                window.location = $(this).val()
            });
            $("#line-item-quick-navigate").chosen().change(function() {
                window.location = $(this).val()
            })
        },
        initializeOrderDetail: function(bootstrapping_data) {
            var pageShim = DataShim(window.DATA_SERVICE_OPTIONS).get_order_detail(bootstrapping_data.line_item_mapping);
            var line_items_table = new Filters.FilteredTableView({
                el: "#line-items-filtered-table",
                button_el: "#line-items-filter-buttons-placeholder",
                filter_groups: Filters.getLineItemFilterGroups()
            });
            line_items_table.render();
            initializeStatusControls();
            initializeAdvertiserTypeAhead(bootstrapping_data.advertisers);
            var $submit_button = $("#submit");
            $submit_button.click(function(e) {
                e.preventDefault();
                $("#order_form").submit()
            });
            var validator = $("#order_form").validate({
                errorPlacement: function(error, element) {
                    element.closest("div").append(error)
                },
                submitHandler: function(form) {
                    var xhr = mopub.Utils.ajaxUpload(form).done(function(resp) {
                        window.location.reload()
                    }).fail(function(data) {
                        validator.showErrors(data.errors)
                    });
                    mopub.Utils.disableUntilFinished($submit_button, xhr)
                }
            });
            var ShimmedCampaign = shims.shimmedCampaignModelFactory(pageShim);
            var order = new ShimmedCampaign({
                id: bootstrapping_data.order_key,
                include_daily: true,
                include_adgroups: true,
                start_date: bootstrapping_data.start_date,
                date_range: bootstrapping_data.date_range
            });
            order.bind("change", function(current_order) {
                renderOrder(order, true);
                var orders = new CampaignCollection;
                orders.add(order);
                var chart_view = new CollectionChartView({
                    collection: orders,
                    start_date: new Date(bootstrapping_data.start_date.getTime()),
                    display_values: ["imp", "clk", "ctr", "conv"]
                });
                chart_view.render();
                _.defer($.fn.tablesorter.bind($("#line_item_table")), {
                    sortList: [
                        [4, 0]
                    ],
                    sortInitialOrder: "desc",
                    headers: {
                        1: {
                            sorter: "status",
                            sortInitialOrder: "asc"
                        },
                        5: {
                            sorter: "goals"
                        },
                        13: {
                            sorter: false
                        }
                    }
                })
            });
            order.fetch();
            $("#switch_to_running_link").click(function(event) {
                $.post("/advertise/ad_source/status/", {
                    status: "play",
                    ad_sources: [bootstrapping_data.order_key]
                }, function() {
                    window.location.reload()
                });
                event.stopPropagation()
            })
        },
        initializeMarketplaceDetail: function(bootstrapping_data) {
            window.MarketplaceGroundControl = {};
            _.extend(window.MarketplaceGroundControl, Backbone.Events);
            var line_item_key = bootstrapping_data.line_item_key,
                adunit_mapping = bootstrapping_data.adunit_mapping;
            var pageShim = DataShim(window.DATA_SERVICE_OPTIONS).get_mpx_line_item_shim(line_item_key, adunit_mapping);
            var block_selection = new BlockSelectionView({
                line_item_key: bootstrapping_data.line_item_key
            });
            block_selection.render();
            var creative_table = new CreativeTableView({
                line_item_key: bootstrapping_data.line_item_key,
                start_date: bootstrapping_data.start_date,
                end_date: bootstrapping_data.end_date,
                pub_id: bootstrapping_data.account_key,
                adgroup_key: bootstrapping_data.line_item_key,
                blocked_domains: bootstrapping_data.blocked_domains,
                blocked_creatives: bootstrapping_data.blocked_creatives
            });
            creative_table.render();
            var domain_blacklist_picker = initializeDomainBlocklist("#domain_blocklist", bootstrapping_data.blocked_domains, bootstrapping_data.line_item_key);
            if ($("#pmp_whitelist").length) {
                var domain_whitelist = _.map(bootstrapping_data.pmp_domain_whitelist, function(val) {
                    return {
                        value: val
                    }
                });
                var domain_whitelist_picker = new PickerView({
                    el: "#pmp_whitelist",
                    displayText: {
                        addLabel: "Add domain(s) to the whitelist",
                        addPlaceholder: "Enter domains in the format “advertisername.com”. " + "Entries must be at least 3 characters. " + "MoPub only allows buyer domains that exactly match the text entered in this field.",
                        pickedLabel: "Currently on whitelist"
                    },
                    classNames: {
                        addRegion: "span4",
                        pickedRegion: "span4"
                    },
                    collection: new DomainCollection(domain_whitelist),
                    parseFunction: parseDomains,
                    url: "/advertise/pmp/domain_whitelist/",
                    keyName: "pmp_deal_key",
                    key: bootstrapping_data.pmp_deal_key
                });
                domain_whitelist_picker.render();
                window.marketplaceSettingsHelpers.listenToAdvertiserOptions(bootstrapping_data.line_item_key);
                domain_blacklist_picker.classNames.addRegion = "span4";
                domain_blacklist_picker.classNames.pickedRegion = "span4"
            }
            domain_blacklist_picker.render();
            var get_selector = function(list_name) {
                if (list_name == "blocklist") {
                    return "textarea[name='" + list_name + "']"
                } else {
                    return "select[name='" + list_name + "']"
                }
            };
            if (bootstrapping_data.newly_created) {
                $('a[data-toggle="#settings"]').click()
            }
            $('#whitelist-submit, .status_change[data-toggle="play"], .status_change[data-toggle="archive"]').click(function() {
                $("#setup-message").fadeOut()
            });
            $("#settings-switch").click(function(evt) {
                evt.preventDefault();
                $('a[data-toggle="#settings"]').click();
                window.location.hash = "settings"
            });
            $("#status-switch").click(function(evt) {
                evt.preventDefault();
                window.location.hash = "line-item-status"
            });
            var URL = "/advertise/line_items/" + bootstrapping_data.line_item_key + "/whitelist/";
            mopub.Selectors.initializeDspWhitelist(URL, bootstrapping_data.DSP_OPTIONS);

            function post_categories(filter_level, categories, attributes) {
                var loading_img = $("#filter-spinner").show();
                var saving = $("#filter-save-status .saving").show();
                var content_filter_url = "/advertise/line_items/" + bootstrapping_data.line_item_key + "/content_filter/";
                var result = $.post(content_filter_url, {
                    filter_level: filter_level,
                    categories: categories,
                    attributes: attributes
                });
                result.success(function(data) {
                    loading_img.hide();
                    saving.hide();
                    if (data.hasOwnProperty("success")) {
                        var saved = $("#filter-save-status .saved").show();
                        setTimeout(function() {
                            saved.fadeOut()
                        }, 1e3)
                    } else {
                        var errored = $("#filter-save-status .error").show();
                        setTimeout(function() {
                            errored.fadeOut()
                        }, 1e3)
                    }
                })
            }
            $("input.content_level").click(function() {
                var filter_level = $(this).val();
                var categories = [];
                var attributes = [];
                if (filter_level === "custom") {
                    $("#categories_div").show();
                    categories = $("#categories").val();
                    attributes = $("#attributes").val()
                } else {
                    $("#categories_div").hide();
                    var customCategoryBlocks = $("#custom_category_blocks");
                    if (customCategoryBlocks.data("allow-hide")) {
                        customCategoryBlocks.hide()
                    }
                }
                post_categories(filter_level, categories, attributes)
            });
            $("input.pmp-override-checkbox").click(function() {
                var pmp_override_url = "/advertise/line_items/{}/override_account_blocking/".format(bootstrapping_data.line_item_key);
                const result = $.post(pmp_override_url, {
                    override_account_blocking: this.checked
                })
            });
            window.marketplaceSettingsHelpers.listenToVideoSettings(bootstrapping_data.line_item_key);
            $("#categories").chosen({
                no_results_text: "No results matched",
                width: "350px"
            }).change(function() {
                var categories = $(this).val();
                post_categories("custom", categories, $("#attributes").val())
            });
            $("#attributes").chosen({
                no_results_text: "No results matched",
                width: "350px"
            }).change(function() {
                var attributes = $(this).val();
                post_categories("custom", $("#categories").val(), attributes)
            });
            window.fetched_apps = 0;
            var num_apps = bootstrapping_data.targeted_apps.length;
            if (num_apps === 0) {
                $("#stats-chart img").remove()
            }
            var MyApp = shims.shimmedAppModelFactory(pageShim);
            var MyAppCollection = AppCollection.extend({
                model: MyApp
            });
            var apps = new MyAppCollection;
            apps.bind("loaded", function() {
                var chart_view = new CollectionChartView({
                    collection: apps,
                    start_date: bootstrapping_data.start_date.getTime(),
                    display_values: ["rev", "imp", "cpm"]
                });
                chart_view.render()
            });
            _.each(bootstrapping_data.targeted_apps, function(app_key) {
                var app = new MyApp({
                    id: app_key,
                    include_daily: true,
                    include_adunits: true,
                    start_date: bootstrapping_data.start_date,
                    date_range: bootstrapping_data.date_range,
                    adgroup: bootstrapping_data.line_item_key,
                    endpoint: "mpx"
                });
                app.bind("change", function() {
                    renderApp(app)
                });
                var finished_loading_callback = function() {
                    window.fetched_apps++;
                    if (window.fetched_apps >= num_apps) {
                        apps.trigger("loaded");
                        $(".sortable").tablesorter({
                            debug: true
                        })
                    }
                };
                apps.add(app);
                app.fetch({
                    error: function() {
                        retryFetch(app, 10, finished_loading_callback)
                    },
                    success: finished_loading_callback
                })
            });
            $(".chosen-select").chosen({
                no_results_text: "No DSPs matched",
                width: "350px"
            })
        },
        initializeLineItemDetail: function(bootstrapping_data) {
            var pageShim = DataShim(window.DATA_SERVICE_OPTIONS).get_line_item_detail(bootstrapping_data.line_item_key, bootstrapping_data.adunit_mapping, bootstrapping_data.start_date, bootstrapping_data.date_range);
            var apps_table = new Filters.FilteredTableView({
                el: "#apps-filtered-table",
                button_el: "#apps-filter-buttons-placeholder",
                filter_groups: Filters.AppFilterGroups
            });
            apps_table.render();
            var adunits_table = new Filters.FilteredTableView({
                el: "#adunits-filtered-table",
                button_el: "#adunits-filter-buttons-placeholder",
                filter_groups: Filters.AdUnitFilterGroups
            });
            adunits_table.render();
            var that = this;
            var ShimmedAdGroup = shims.shimmedAdGroupModelFactory(pageShim);
            var ShimmedAdGroupCollection = AdGroupCollection.extend({
                model: ShimmedAdGroup
            });
            var line_item = new ShimmedAdGroup({
                id: bootstrapping_data.line_item_key,
                include_daily: true,
                include_creatives: true,
                start_date: bootstrapping_data.start_date,
                date_range: bootstrapping_data.date_range
            });
            line_item.bind("change", function(current_line_item) {
                renderLineItem(current_line_item, true);
                var line_items = new ShimmedAdGroupCollection;
                line_items.add(line_item);
                var chart_view = new CollectionChartView({
                    collection: line_items,
                    start_date: new Date(bootstrapping_data.start_date.getTime()),
                    display_values: ["imp", "clk", "ctr", "conv"]
                });
                chart_view.render();
                that.initializeCreativeTableSorting()
            });
            line_item.fetch();
            var apps_rendered = 0;
            var ShimmedApp = shims.shimmedAppModelFactory(pageShim);
            _.each(bootstrapping_data.targeted_apps, function(app_key) {
                var app = new ShimmedApp({
                    id: app_key,
                    adgroup: bootstrapping_data.line_item_key,
                    include_adunits: true,
                    start_date: bootstrapping_data.start_date,
                    date_range: bootstrapping_data.date_range
                });
                app.bind("change", function(current_app) {
                    renderApp(current_app);
                    apps_rendered++;
                    if (apps_rendered === bootstrapping_data.targeted_apps.length) {
                        $(".sortable").tablesorter({
                            sortList: [
                                [3, 1]
                            ],
                            sortInitialOrder: "desc"
                        })
                    }
                });
                app.fetch()
            })
        },
        initializeCreativeFormFields: function() {
            $('[name="ad_type"]').filter(":checked").change();
            $("#ad_type [value=vast]").parent().addClass("format_dependent full full_tablet rewarded_video");
            $('[name="format"]').change();
            $('[name="media_type"]').filter(":checked").change()
        },
        initializeBaseLineItemDetail: function(bootstrapping_data) {
            initializeStatusControls(true);
            initializeBudgetControls(bootstrapping_data.line_item_key);
            CreativeModal.CreativeModalController.initialize();
            var status_map = {
                paused: "pause",
                running: "play",
                archived: "archive"
            };
            $(document).ajaxComplete(function(event, xhr, settings) {
                if (settings.url == "/advertise/ad_source/status/") {
                    var resp = $.parseJSON(xhr.responseText);
                    if (resp.success) {
                        _.each(resp.newStatus, function(val, key, list) {
                            $("#line_item_table").find("#" + key).find(".btn-pause-play-archive button").removeClass("active");
                            $("#line_item_table").find("#" + key).find(".btn-" + status_map[val]).addClass("active");
                            $("#line_item_table").find("#text-" + key).text(val)
                        })
                    }
                }
            });
            var copy_modal = $("#copy_modal").modal({
                show: false,
                keyboard: false,
                backdrop: true
            });
            var $copy_to_order = $("#copy-to-order");
            var width = $copy_to_order.css("width");
            $copy_to_order.chosen({
                width: width
            });
            $("#copy-line-item .copy_option").click(function() {
                var $option = $(this),
                    toggle = $option.data("toggle");
                if (toggle === "copy_with") {
                    var promise = copyLineItem(bootstrapping_data.line_item_key, bootstrapping_data.order_key, true)
                } else if (toggle === "copy_without") {
                    var promise = copyLineItem(bootstrapping_data.line_item_key, bootstrapping_data.order_key, false)
                } else if (toggle === "copy_to_another") {
                    $("#copy-to-order").val(bootstrapping_data.order_key);
                    copy_modal.modal("show");
                    $("#copy-ok-button").click(function() {
                        $("#modal-loading-img").removeClass("hidden");
                        $("#copy-ok-button").attr("disabled", true);
                        var order = $("#copy-to-order").val();
                        var copy_creatives = $("#copy_with_creatives").is(":checked");
                        var promise = copyLineItem(bootstrapping_data.line_item_key, order, copy_creatives);
                        promise.done(function() {
                            $("#modal-loading-img").addClass("hidden");
                            $("#copy-ok-button").attr("disabled", false)
                        })
                    })
                } else {
                    throw Error("malformed data toggle")
                }
            });
            $('[name="ad_type"]').change(function() {
                var ad_type = $(this).val();
                $(".ad_type_dependent", $(this).closest("form")).each(function() {
                    $(this).toggle($(this).hasClass(ad_type))
                });
                $(".ad_type_exclude", $(this).closest("form")).each(function() {
                    $(this).toggle(!$(this).hasClass(ad_type))
                })
            });
            $('[name="format"]').change(function() {
                var format = $(this).val();
                var form = $(this).closest("form");
                var native_select_option = $("#ad_type [value=native]", form);
                if (format === "native") {
                    native_select_option.parent().show();
                    native_select_option.attr("checked", true).change();
                    $("#id_launchpage", form).parents(".control-group").hide()
                } else if (format == "rewarded_video") {
                    $("#id_ad_type_3", form).attr("checked", true).change();
                    native_select_option.parent().hide()
                } else {
                    native_select_option.parent().hide();
                    $("#id_ad_type_0", form).attr("checked", true).change();
                    $("#id_launchpage", form).parents(".control-group").show()
                }
                $(".format_dependent", $(this).closest("form")).each(function() {
                    $(this).toggle($(this).hasClass(format))
                })
            });
            $('[name="media_type"]').change(function() {
                var native_media_type = $(this).val();
                var isVideoEnabled = native_media_type === "video";
                var currentForm = $(this).closest("form");
                CreativeModal.CreativeModalController.setVideoFieldsEnabled(currentForm, isVideoEnabled)
            });
            this.initializeCreativeFormFields();
            $("#advanced_fields_button").click(function() {
                var list = $("ul#advanced_fields_list", $(this).closest("form"));
                if (list.is(":visible")) {
                    list.slideUp();
                    $(this).html("More Options")
                } else {
                    list.slideDown();
                    $(this).html("Less Options")
                }
            });
            $("#creative_table .preview").click(function() {
                var $modal = $(this).siblings("div.modal.preview");
                var $iframe = $modal.find("iframe");
                if (!$iframe.attr("src")) {
                    var src = $modal.find("input").val();
                    $iframe.attr("src", src);
                    $iframe.load(function() {
                        $iframe.css("background-image", "none")
                    })
                }
                var width = parseInt($iframe.attr("width"));
                var height = parseInt($iframe.attr("height"));
                $modal.css({
                    width: "auto",
                    height: "auto",
                    "margin-left": function() {
                        return -($(this).width() / 2)
                    },
                    "margin-top": function() {
                        return -($(this).height() / 2)
                    }
                })
            });
            $("[data-image-preview-modal]").each(function() {
                var $target = $(this),
                    url = $target.attr("href"),
                    width = $target.data("image-width"),
                    height = $target.data("image-height");
                CreativeModal.CMHelper.buildPopover($target, url, height, width)
            });
            $(".edit_creative_form_container .delete").on("click", function(e) {
                var creative_url = $(this).attr("href");
                var deleteConfirmed = function(e) {
                    var xhr = $.ajax({
                        type: "DELETE",
                        url: creative_url
                    }).done(function() {
                        window.location.reload()
                    });
                    mopub.Utils.disableUntilFinished(this, xhr);
                    e.preventDefault()
                };
                $("#confirm-creative-delete").on("click", deleteConfirmed);
                $("#delete-modal").on("hidden", function() {
                    $("#confirm-creative-delete").off("click", deleteConfirmed)
                });
                $("#delete-modal").modal("show");
                e.preventDefault()
            });
            var form_validator = {
                ignore: ".ignore",
                onfocusout: false,
                errorPlacement: function(error, element) {
                    element.closest("div").append(error)
                },
                submitHandler: function(form) {
                    var validator = this;
                    var xhr = mopub.Utils.ajaxUpload(form).fail(function(data) {
                        validator.showErrors(data.errors)
                    }).done(function(resp) {
                        window.location = resp.redirect
                    });
                    var submitButton = $(form).parents(".creative-form").find(".creative-submit");
                    mopub.Utils.disableUntilFinished(submitButton, xhr)
                }
            };
            $(".creative-form form").each(function() {
                $(this).validate(form_validator)
            });
            $(".creative-submit").click(function(e) {
                var $creativeForm = $(this).parents(".creative-form").find("form");
                var is_native = $creativeForm.find('select[name="format"]').val() == "native";
                if (!is_native) {
                    $creativeForm.submit()
                } else {
                    if (CreativeModal.CreativeModalController.handleNativeFormSubmit($creativeForm)) {
                        $creativeForm.submit()
                    }
                }
                e.preventDefault()
            })
        },
        initializeCreativeTableSorting: function() {
            $("#creative_table").tablesorter({
                sortList: [
                    [2, 1]
                ],
                sortInitialOrder: "desc",
                headers: {
                    0: {
                        sorter: "status",
                        sortInitialOrder: "asc"
                    }
                }
            })
        },
        initializeOrderAndLineItemFormCustom: function(bootstrapping_data) {
            console.log('CUSTOM INIT FUNCTION');
            var FrequencyCapView = morequire("mopub.views.components.FrequencyCapView");
            var FrequencyCapContainer = morequire("mopub.views.components.FrequencyCapContainer");
            var fcapContainer = new FrequencyCapContainer({
                el: "#frequency-cap-container"
            }).render().setData(bootstrapping_data.impression_caps.length ? bootstrapping_data.impression_caps : [
                [3600, null]
            ]);
            this.line_item_id_overrides = bootstrapping_data.line_item_id_overrides;

            function _initializeLineItemFilteredTableView() {
                var order_line_item_table = new Filters.FilteredTableView({
                    el: "#filtered-targeting-table",
                    button_el: "#targeting_setup_table_filter_button",
                    filter_groups: _.sortBy(Filters.AdUnitFilterGroups.concat([{
                        groupName: "Apps",
                        options: bootstrapping_data.app_to_name
                    }]), "groupName")
                });
                order_line_item_table.render()
            }

            function _initializeDayParting() {
                $("#id_form-0-weekdays option").each(function() {
                    if ($(this).is(":selected")) {
                        $("#day-part-weekdays a[data-toggle='" + $(this).val() + "']").addClass("active")
                    }
                });
                $("#daypart-checkbox-all input").change(function() {
                    $("#daypart-checkbox-first input, #daypart-checkbox input").prop("checked", $(this).prop("checked"))
                });
                var defaults = {
                    timeFormat: "h:i A",
                    step: 15
                };
                var end_time_defaults = _.defaults({
                    extraTimeOptions: [{
                        hour: 23,
                        minute: 59
                    }]
                }, defaults);
                _.each(["0", "1"], function(form_number) {
                    $("#id_form-" + form_number + "-start_time").timepicker(defaults);
                    var start_time = $("#id_form-" + form_number + "-start_time").val();
                    var end_time_values = _.defaults({
                        disableTimeRanges: [
                            ["12:00 AM", start_time]
                        ]
                    }, end_time_defaults);
                    $("#id_form-" + form_number + "-end_time").timepicker(end_time_values);
                    $("#id_form-" + form_number + "-start_time").on("changeTime", function(e) {
                        var new_time = e.target.value;
                        var new_options = _.defaults({
                            disableTimeRanges: [
                                ["12am", new_time]
                            ]
                        }, end_time_defaults);
                        var $end_time = $("#id_form-" + form_number + "-end_time");
                        $end_time.timepicker("remove");
                        $end_time.timepicker(new_options);
                        $end_time.val("")
                    })
                })
            }

            function _toggleHiddenDayParts() {
                $("#day-part-weekdays a").click(function(e) {
                    e.preventDefault();
                    var $this = $(this);
                    $this.toggleClass("active");
                    var toggling = $this.data("toggle");
                    $("#id_form-0-weekdays option[value='" + toggling + "']").toggleAttr("selected", "selected")
                })
            }

            function _initializePmpPriceConversion(buyerPriceInput, pubPriceInput, pubPriceField, revShareField) {
                var $buyerPriceInput = $(buyerPriceInput);
                var $pubPriceInput = $(pubPriceInput);
                var $pubPriceField = $(pubPriceField);
                var revShare = $(revShareField).val() / 100;

                function roundUp(value, decimals) {
                    var floatAns = Math.ceil(value * Math.pow(10, decimals)) * Math.pow(10, -decimals);
                    return floatAns.toFixed(decimals)
                }

                function round(value, decimals) {
                    var floatAns = Math.round(value * Math.pow(10, decimals)) * Math.pow(10, -decimals);
                    return floatAns.toFixed(decimals)
                }

                function pubPriceFromBuyerPrice(strBuyerPrice) {
                    return round(parseFloat(strBuyerPrice) * revShare, 4)
                }

                function buyerPriceFromPubPrice(strPubPrice) {
                    var intermed = round(parseFloat(strPubPrice) / revShare, 4);
                    return roundUp(intermed, 2)
                }

                function setToDisregardNonNumericInput($el) {
                    $el.keydown(function(e) {
                        if (_.contains([46, 8, 9, 27, 13, 110, 190], e.keyCode) || (e.ctrlKey === true || e.metaKey === true) && _.contains([65, 67, 86, 88], e.keyCode) || e.keyCode >= 35 && e.keyCode <= 40) {
                            return
                        }
                        var validNumberRow = 48 <= e.keyCode && e.keyCode <= 57 && !e.shiftKey;
                        var validNumberPad = 96 <= e.keyCode && e.keyCode <= 105;
                        if (!validNumberRow && !validNumberPad) {
                            e.preventDefault()
                        }
                    })
                }
                setToDisregardNonNumericInput($buyerPriceInput);
                setToDisregardNonNumericInput($pubPriceInput);

                function setupOnChangeBinding($el, toPubPriceConversionFn, eventName) {
                    $el.change(function() {
                        var val = $(this).val();
                        if (val) {
                            $(this).val(round(val, 2));
                            $pubPriceField.val(toPubPriceConversionFn($(this).val()))
                        } else {
                            $pubPriceField.val("")
                        }
                        $pubPriceField.trigger(eventName)
                    })
                }
                setupOnChangeBinding($buyerPriceInput, pubPriceFromBuyerPrice, "buyerPriceChange");
                setupOnChangeBinding($pubPriceInput, _.identity, "pubPriceChange");
                $pubPriceField.on("buyerPriceChange", function(e) {
                    var val = $(this).val();
                    $pubPriceInput.val(val ? round(val, 2) : "")
                });
                $pubPriceField.on("pubPriceChange", function(e) {
                    var val = $(this).val();
                    $buyerPriceInput.val(val ? buyerPriceFromPubPrice(val) : "")
                });
                if ($pubPriceField.val()) {
                    $pubPriceField.trigger("buyerPriceChange").trigger("pubPriceChange")
                }
            }

            function _toggleAdgroupDependentHiddenFields(adgroup_type) {
                $(".adgroup_type_dependent").each(function() {
                    $(this).toggleClass("hidden", !$(this).hasClass(adgroup_type))
                })
            }

            function _updateAdgroupDependentDynamicLayout(adgroup_type) {
                $(".parent_when_adgroup_type").each(function() {
                    if ($(this).hasClass(adgroup_type)) {
                        $(this).parent().find(".adgroup_dependent_child").appendTo(this)
                    }
                })
            }
            _initializeLineItemFilteredTableView();
            initializeAdvertiserTypeAhead(bootstrapping_data.advertisers);
            _toggleHiddenDayParts();
            _initializeDayParting();
            _initializePmpPriceConversion("#id_pmp-buyer_price_input", "#id_pmp-net_price_input", "#id_pmp-net_price", "#id_pmp-rev_share");
            var validator = $("#order_and_line_item_form").validate({
                errorPlacement: function(error, element) {
                    element.closest("div").append(error)
                },
                submitHandler: function(form) {
                    var addImpressionCaps = function(formData) {
                        formData.append("impression_caps", fcapContainer.serializeData());
                        return formData
                    };
                    var $submit_button = $("#submit");
                    var xhr = mopub.Utils.ajaxUpload(form, addImpressionCaps).done(function(resp) {
                        window.location = resp.redirect
                    }).fail(function(data) {
                        if (xhr.statusCode == 403) {
                            mopub.Utils.unableToSaveChangesModal().render()
                        }
                        if (data.errors.start_datetime_1) {
                            data.errors.start_datetime_0 = ""
                        }
                        if (data.errors.end_datetime_1) {
                            data.errors.end_datetime_0 = ""
                        }
                        validator.showErrors(data.errors);
                        $("input.error").first().focus()
                    });
                    mopub.Utils.disableUntilFinished($submit_button, xhr)
                }
            });
            $("#submit").click(function(e) {
                e.preventDefault();
                $("#order_and_line_item_form").submit()
            });
            var initial_adgroup_type = $('[name="adgroup_type"]').val();
            _toggleAdgroupDependentHiddenFields(initial_adgroup_type);
            _updateAdgroupDependentDynamicLayout(initial_adgroup_type);
            $('[name="priority"]').change(function() {
                $(this).addClass("already_selected")
            });
            $('[name="network_type"]').change(this.networkTypeChange).change();
            $("#id_order-advertiser").change(function() {
                if ($(this).val() === bootstrapping_data.company_name + " (Self)") {
                    $("#id_adgroup_type").val("promo").trigger("change")
                }
            });
            $("#id_adgroup_type").change(function() {
                var type = $(this).val();
                $("#apps-filtered-table .adunit").attr("data-adgroup-type", type);
                $("#apps-filtered-table .adunit").each(function(idx) {
                    var adunit = $(this);
                    var disabled = !isAdUnitTargetingEnabledForLineItemType(adunit, type);
                    adunit.toggleClass("rewarded-video-disabled", disabled && adunit.hasClass("rewarded-video"));
                    var checkbox = $(this).children("input");
                    var checked = checkbox.prop("checked");
                    checkbox.prop("disabled", disabled);
                    checkbox.prop("checked", checked && !disabled)
                })
            }).trigger("change");

            function isAdUnitTargetingEnabledForLineItemType(adunit, lineItemType) {
                var mpxTypes = ["mpx_line_item", "pmp_line_item"];
                if (adunit.hasClass("mpx-disabled") && mpxTypes.indexOf(lineItemType) != -1) {
                    return false
                }
                return true
            }
            $('[name="adgroup_type"]').change(function() {
                var adgroup_type = $(this).val(),
                    already_selected = $("#id_priority").hasClass("already_selected");
                if (!already_selected) {
                    $("#id_priority").val(bootstrapping_data.priority_levels_by_adgroup_type[adgroup_type])
                }
                $(this).addClass("already_selected");
                _toggleAdgroupDependentHiddenFields(adgroup_type);
                _updateAdgroupDependentDynamicLayout(adgroup_type)
            });
            TooltipMixin.hoverablePopover($(".adunit.mpx-disabled div.popover-target"), {
                delay: 200,
                animation: true,
                placement: "left",
                container: "body",
                title: "MoPub Marketplace Native Ads",
                content: 'Native ads from MoPub Marketplace are not currently enabled for your account. Please contact <a href="mailto:nativeads@twitter.com">nativeads@twitter.com</a> to request access. Note that you can still run native ad campaigns with direct ad partners.'
            });
            TooltipMixin.hoverablePopover($(".adunit.rewarded-video div.popover-target"), {
                delay: 200,
                animation: true,
                placement: "left",
                container: "body",
                title: "Rewarded Video Ads",
                content: "Line items of this type cannot target rewarded video ad units."
            });
            $('input[type="text"].date').datepicker({
                startDate: Constants.dates.epoch_start,
                endDate: Constants.dates.epoch_end
            });

            function makeValidTime(timeStr, defHour, defMin, defAmPm) {
                var timePat = /^(\d{1,2}):(\d{2})(\s?(AM|am|PM|pm|aM|pM|Pm|Am))?$/;
                if (defMin < 10) {
                    defMin = "0" + defMin
                }
                var matchArray = timeStr.match(timePat);
                if (matchArray == null) {
                    return defHour + ":" + defMin + " " + defAmPm
                }
                var hour = matchArray[1];
                var minute = matchArray[2];
                var ampm = matchArray[4];
                if (hour >= 12 && hour <= 23) {
                    hour = hour - 12;
                    if (hour == 0) {
                        hour = 12;
                        if (ampm === undefined) {
                            ampm = "PM"
                        }
                    } else {
                        ampm = "PM"
                    }
                }
                if (hour == 0) {
                    ampm = "AM";
                    hour = 12
                }
                if (minute < 0 || minute > 59) {
                    minute = defMin
                }
                if (hour < 0 || hour > 23) {
                    hour = defHour
                }
                if (ampm === undefined) {
                    ampm = defAmPm
                } else {
                    ampm = ampm.toUpperCase()
                }
                return hour + ":" + minute + " " + ampm
            }
            $('input[name="start_datetime_0"]').change(function(e) {
                e.preventDefault();
                var val = $(this).val();
                if (val != "") {
                    $('input[name="start_datetime_1"]').change()
                }
            });
            $('input[name="end_datetime_0"]').change(function(e) {
                e.preventDefault();
                var val = $(this).val();
                if (val != "") {
                    $('input[name="end_datetime_1"]').change()
                }
            });
            $('input[name$="_datetime_1"]').change(function(e) {
                e.preventDefault();
                var name = $(this).attr("name");
                var val = $(this).val();
                if (name == "start_datetime_1") {
                    if ($('input[name="start_datetime_0"]').val() == "") {
                        val = ""
                    } else {
                        val = makeValidTime(val, 12, 0, "AM")
                    }
                } else if (name == "end_datetime_1") {
                    if ($('input[name="end_datetime_0"]').val() == "") {
                        val = ""
                    } else {
                        val = makeValidTime(val, 11, 59, "PM")
                    }
                }
                $(this).val(val)
            });
            $('input[name="end_datetime_0"], input[name="end_datetime_1"], select[name="budget_type"], input[name="budget_strategy"]').change(function() {
                if (!$('input[name="end_datetime_0"]').val() && !$('input[name="end_datetime_1"]').val()) {
                    if ($('select[name="budget_type"]').val() == "full_campaign") {
                        $('input[name="budget_strategy"][value="evenly"]').attr("disabled", "disabled");
                        $('input[name="budget_strategy"][value="evenly"]').parent().addClass("muted");
                        return
                    }
                    if ($('input[name="budget_strategy"][value="evenly"]').prop("checked")) {
                        $('select[name="budget_type"] option[value="full_campaign"]').attr("disabled", "disabled");
                        return
                    }
                }
                $('input[name="budget_strategy"][value="evenly"]').parent().removeClass("muted");
                $('select[name="budget_type"] option[value="full_campaign"]').removeAttr("disabled");
                $('input[name="budget_strategy"][value="evenly"]').removeAttr("disabled")
            }).change();
            $('select[name="bid_strategy"]').change(function() {
                var bid_strategy = $(this).val();
                var budget_type_options = $('select[name="budget_type"] option');
                var metric = bid_strategy === "cpm" ? "impressions" : bootstrapping_data.metrics_based ? {
                    cpc: "clicks",
                    cpa: "conversions"
                }[bid_strategy] : "USD";
                budget_type_options[0].innerHTML = "{}/day".format(metric);
                budget_type_options[1].innerHTML = "total {}".format(metric)
            }).change();
            $('select[name="budget_type"]').change(function() {
                var budget_type = $(this).val();
                $(".budget_type_dependent").each(function() {
                    $(this).toggle($(this).hasClass(budget_type))
                })
            }).change();
            $("#all-adunits").change(function() {
                var topLevelChecked = $(this).prop("checked");
                $("#apps-filtered-table .adunit").each(function(idx) {
                    var checkbox = $(this).children("input");
                    checkbox.prop("checked", topLevelChecked && checkbox.is(":visible") && !checkbox.prop("disabled"))
                })
            });
            var $targeted_countries = $("#id_targeted_countries");
            var $targeted_regions = $("#id_targeted_regions");
            var $targeted_cities = $("#id_targeted_cities");
            var $targeted_zip_codes = $("#id_targeted_zip_codes");
            var $targeted_carriers = $("#id_targeted_carriers");
            var $region_targeting_type_all = $("#id_region_targeting_type_0");
            var $region_targeting_type_regions_and_cities = $("#id_region_targeting_type_1");
            var $region_targeting_type_zip_codes = $("#id_region_targeting_type_2");
            var $connectivity_targeting_type_all = $("#id_connectivity_targeting_type_0");
            var $connectivity_targeting_type_carriers = $("#id_connectivity_targeting_type_2");

            function update_geographical_and_connectivity_targeting() {
                var targeted_countries = $targeted_countries.val();
                var us_is_targeted = _.include(targeted_countries, "US");
                var ca_is_targeted = _.include(targeted_countries, "CA");
                var gb_is_targeted = _.include(targeted_countries, "GB");
                var wifi_is_targeted = $('input[name="connectivity_targeting_type"]:checked').val() == "wi-fi";
                update_regions_and_cities(targeted_countries, us_is_targeted, ca_is_targeted);
                update_zip_codes(us_is_targeted, wifi_is_targeted);
                update_carriers(us_is_targeted, ca_is_targeted, gb_is_targeted)
            }

            function update_regions_and_cities(targeted_countries, us_is_targeted, ca_is_targeted) {
                if (!targeted_countries) {
                    if ($region_targeting_type_regions_and_cities.is(":checked")) {
                        $region_targeting_type_all.click()
                    }
                    $region_targeting_type_regions_and_cities.attr("disabled", true)
                } else {
                    $region_targeting_type_regions_and_cities.removeAttr("disabled");
                    targeted_cities_ajax_data.country = targeted_countries
                }
                update_regions(us_is_targeted, ca_is_targeted);
                update_cities(targeted_countries, us_is_targeted)
            }

            function update_regions(us_is_targeted, ca_is_targeted) {
                if (!us_is_targeted && !ca_is_targeted && !non_wifi_targeting) {
                    $targeted_regions.html("");
                    $targeted_regions.attr("disabled", true)
                } else {
                    if (us_is_targeted) {
                        add_options($targeted_regions, bootstrapping_data.US_STATES_TARGETING);
                        add_options($targeted_regions, bootstrapping_data.US_METROS)
                    } else {
                        remove_options($targeted_regions, bootstrapping_data.US_STATES_TARGETING);
                        remove_options($targeted_regions, bootstrapping_data.US_METROS)
                    }
                    if (ca_is_targeted) {
                        add_options($targeted_regions, bootstrapping_data.CA_PROVINCES)
                    } else {
                        remove_options($targeted_regions, bootstrapping_data.CA_PROVINCES)
                    }
                    $targeted_regions.removeAttr("disabled")
                }
                $targeted_regions.trigger("chosen:updated")
            }
            var city_name_regex = /^(.*), (.*), (.*)$/;

            function update_cities(targeted_countries, us_is_targeted) {
                var specific_regions_are_targeted = $region_targeting_type_regions_and_cities.attr("checked");
                if (!(targeted_countries && specific_regions_are_targeted)) {
                    $targeted_cities.attr("disabled", true)
                } else {
                    $targeted_cities.attr("disabled", false);
                    if (us_is_targeted) {
                        add_options($targeted_cities, bootstrapping_data.MAJOR_US_CITIES)
                    }
                    $("option:selected", $targeted_cities).each(function(index, option) {
                        var $option = $(option);
                        var name = $option.html();
                        var match = city_name_regex.exec(name);
                        var country = match[3];
                        if (!_.include(targeted_countries, country)) {
                            $option.remove()
                        }
                    })
                }
                $targeted_cities.trigger("chosen:updated")
            }

            function update_zip_codes(us_is_targeted, wifi_is_targeted) {
                var region_targeting_type_zip_codes = $region_targeting_type_zip_codes.is(":checked");
                if ((!us_is_targeted || !wifi_is_targeted) && !non_wifi_targeting) {
                    $targeted_zip_codes.val("");
                    if ($region_targeting_type_zip_codes.is(":checked")) {
                        $region_targeting_type_all.click()
                    }
                    $region_targeting_type_zip_codes.attr("disabled", true);
                    $targeted_zip_codes.attr("disabled", true)
                } else {
                    $region_targeting_type_zip_codes.removeAttr("disabled");
                    $targeted_zip_codes.attr("disabled", !region_targeting_type_zip_codes)
                }
            }

            function update_carriers(us_is_targeted, ca_is_targeted, gb_is_targeted) {
                if (!us_is_targeted && !ca_is_targeted && !gb_is_targeted) {
                    $targeted_carriers.html("");
                    if ($connectivity_targeting_type_carriers.is(":checked")) {
                        $connectivity_targeting_type_all.attr("checked", true);
                        $("#id_targeted_carriers").parent().hide()
                    }
                    $connectivity_targeting_type_carriers.attr("disabled", true)
                } else {
                    if (us_is_targeted) {
                        add_options($targeted_carriers, bootstrapping_data.US_CARRIERS)
                    } else {
                        remove_options($targeted_carriers, bootstrapping_data.US_CARRIERS)
                    }
                    if (ca_is_targeted) {
                        add_options($targeted_carriers, bootstrapping_data.CA_CARRIERS)
                    } else {
                        remove_options($targeted_carriers, bootstrapping_data.CA_CARRIERS)
                    }
                    if (gb_is_targeted) {
                        add_options($targeted_carriers, bootstrapping_data.GB_CARRIERS)
                    } else {
                        remove_options($targeted_carriers, bootstrapping_data.GB_CARRIERS)
                    }
                    $connectivity_targeting_type_carriers.removeAttr("disabled")
                }
                $targeted_carriers.trigger("chosen:updated")
            }
            $targeted_countries.chosen().change(update_geographical_and_connectivity_targeting);
            $('input[name="region_targeting_type"]').change(update_geographical_and_connectivity_targeting);
            $('input[name="region_targeting_type"]').click(function() {
                $('input[name="region_targeting_type"]').parent().siblings("div").hide();
                $(this).parent().siblings("div").show()
            });
            $('input[name="region_targeting_type"]:checked').click();
            $targeted_regions.chosen();
            var targeted_cities_ajax_data = {
                featureClass: "P",
                maxRows: 10,
                username: "MoPub"
            };
            $targeted_cities.ajaxChosen({
                data: targeted_cities_ajax_data,
                dataType: "json",
                jsonTermKey: "name_startsWith",
                method: "GET",
                minTermLength: 3,
                traditional: true,
                url: "https://ba-ws.geonames.net/searchJSON"
            }, function(data) {
                var terms = {};
                for (var index in data.geonames) {
                    var geoname = data.geonames[index];
                    if (geoname.countryCode === "CA") {
                        geoname.adminCode1 = CANADA_CODE_TO_PROVINCE[geoname.adminCode1]
                    }
                    var key = "(" + geoname.lat + "," + geoname.lng + ",'" + geoname.name + "','" + geoname.adminCode1 + "','" + geoname.countryCode + "')";
                    var value = geoname.name + ", " + geoname.adminCode1 + ", " + geoname.countryCode;
                    terms[key] = value
                }
                return terms
            });
            $("#id_connectivity_targeting_type_1").change(function() {
                update_geographical_and_connectivity_targeting()
            });
            $connectivity_targeting_type_all.click(function(event) {
                if (($targeted_regions.val() || $targeted_zip_codes.val()) && non_wifi_targeting !== true) {
                    event.preventDefault();
                    $("#target_carriers_warning .continue").unbind().click(function() {
                        $connectivity_targeting_type_all.attr("checked", "checked");
                        update_geographical_and_connectivity_targeting()
                    });
                    $("#target_carriers_warning").modal()
                } else {
                    update_geographical_and_connectivity_targeting()
                }
            });
            $connectivity_targeting_type_carriers.click(function(event) {
                if (($targeted_regions.val() || $targeted_zip_codes.val()) && non_wifi_targeting !== true) {
                    event.preventDefault();
                    $("#target_carriers_warning .continue").unbind().click(function() {
                        $connectivity_targeting_type_carriers.attr("checked", "checked");
                        $("#id_targeted_carriers").parent().show();
                        update_geographical_and_connectivity_targeting()
                    });
                    $("#target_carriers_warning").modal()
                } else {
                    $("#id_targeted_carriers").parent().show();
                    update_geographical_and_connectivity_targeting()
                }
            });
            $targeted_carriers.chosen();
            update_geographical_and_connectivity_targeting();
            _.each(bootstrapping_data.targeted_regions, function(targeted_region) {
                $('option[value="' + targeted_region + '"]', $targeted_regions).prop("selected", "selected")
            });
            $targeted_regions.trigger("chosen:updated");
            var city_tuple_regex = /^\((.*),(.*),'(.*)','(.*)','(.*)'\)$/;
            _.each(bootstrapping_data.targeted_cities, function(targeted_city) {
                var match = city_tuple_regex.exec(targeted_city);
                var name = match[3] + ", " + match[4] + ", " + match[5];
                $targeted_cities.append($("<option />", {
                    html: name,
                    selected: "selected",
                    value: targeted_city
                }))
            });
            $targeted_cities.trigger("chosen:updated");
            _.each(bootstrapping_data.targeted_carriers, function(targeted_carrier) {
                $('option[value="' + targeted_carrier + '"]', $targeted_carriers).prop("selected", "selected")
            });
            $targeted_carriers.trigger("chosen:updated");
            $('input[name="device_targeting"]').change(function() {
                if ($(this).val() == "0") {
                    $("#device_targeting_details").slideUp()
                } else {
                    $("#device_targeting_details").slideDown()
                }
            });
            if ($('input[name="device_targeting"]:checked').val() == "0") {
                $("#device_targeting_details").hide()
            }
            $('[name="included_apps"]').chosen();
            $('[name="excluded_apps"]').chosen();
            if ($('[name="included_apps"] option:selected').length > 0) {
                $("#user_targeting_type").val("included_apps")
            } else {
                $("#user_targeting_type").val("excluded_apps")
            }
            $("#user_targeting_type").change(function() {
                var $this = $(this);
                if ($this.val() == "included_apps") {
                    $("#id_excluded_apps_chosen").hide();
                    $('[name="excluded_apps"] option:selected').removeAttr("selected");
                    $('[name="excluded_apps"]').trigger("chosen:updated");
                    $("#id_included_apps_chosen").show()
                } else {
                    $("#id_included_apps_chosen").hide();
                    $('[name="included_apps"] option:selected').removeAttr("selected");
                    $('[name="included_apps"]').trigger("chosen:updated");
                    $("#id_excluded_apps_chosen").show()
                }
            }).change()
        },
        networkTypeChange: function() {
            var network_type = $(this).val();
            var line_item_id_override_config = OrdersController.line_item_id_overrides[network_type];
            $(".network_type_dependent").addClass("hidden");
            $(".network_type_dependent.{}".format(network_type)).removeClass("hidden");
            $(".network_id_override").addClass("hidden");
            _.each(line_item_id_override_config, function(label_text, network_id_field) {
                var id_field_label = 'label[for="id_{}"]'.format(network_id_field);
                $(id_field_label).text(label_text);
                $("#" + network_id_field).removeClass("hidden")
            })
        }
    };
    window.OrdersControllerCustom = OrdersControllerCustom
}).call(this);
momodule("mopub.controllers.publisher", function(exports) {
    var AdUnitForForm = morequire("mopub.models.publisher.AdUnit"),
        AdUnitForm = morequire("mopub.views.publisher.forms.AdUnitForm"),
        AppForForm = morequire("mopub.models.publisher.App"),
        AppForm = morequire("mopub.views.publisher.forms.AppForm"),
        AppAndAdUnitForm = morequire("mopub.views.publisher.forms.AppAndAdUnitForm"),
        Publisher = morequire("mopub.models.publisher"),
        RewardedVideoCurrencyCollection = morequire("mopub.models.accounts.RewardedVideoCurrencyCollection"),
        DataShim = morequire("mopub.models.data_shim.DataShim"),
        shims = morequire("mopub.models.shim_models"),
        TooltipMixin = morequire("mopub.mixins.views.TooltipMixin");
    var FILL_RATE_TOOLTIP_TEXT_APP = "Fill Rate represents impressions divided by ad requests for this app";
    var FILL_RATE_TOOLTIP_TEXT_ADUNIT = "Fill Rate represents impressions divided by ad requests for this ad unit";
    var toast_error = function() {
        var message = $("Please <a href='#'>refresh the page</a> and try again.").click(function(e) {
            e.preventDefault();
            window.location.reload()
        });
        Toast.error(message, "Error fetching app data.")
    };

    function initializeTargetingTable() {
        $("#targeting_table").tablesorter({
            sortList: [
                [3, 0]
            ],
            sortInitialOrder: "desc",
            headers: {
                0: {
                    sorter: "status",
                    sortInitialOrder: "asc"
                },
                4: {
                    sorter: "goals"
                },
                12: {
                    sorter: false
                }
            }
        });
        $("#targeting_table").trigger("update")
    }

    function initializeDeleteForm() {
        $("#confirm-delete-button").click(function() {
            $("#dashboard-deleteForm").submit()
        })
    }
    var preloadImages = function() {
        _.each(Publisher.getPhoneFormats(), function(format) {
            var img = new Image;
            img.src = "/public/images/setup/phone-{}.png".format(format.class)
        });
        _.each(Publisher.getTabletFormats(), function(format) {
            var img = new Image;
            img.src = "/public/images/setup/tablet-{}.png".format(format.class)
        })
    };
    var loadAdgroupStats = function(adgroup_keys, start_date, date_range, app_key, adunit_key, pageShim) {
        var NewAdGroup = pageShim ? shims.shimmedAdGroupModelFactory(pageShim) : AdGroup;
        var loaded_adgroups = 0;
        _.each(adgroup_keys, function(adgroup_key) {
            var initializeDict = {
                id: adgroup_key,
                start_date: start_date,
                date_range: date_range
            };
            if (app_key) {
                initializeDict.app = app_key
            } else if (adunit_key) {
                initializeDict.adunit = adunit_key
            }
            var line_item = new NewAdGroup(initializeDict);
            var line_item_view = new LineItemView({
                model: line_item,
                el: ".advertiser_table"
            });
            line_item.bind("change", function() {
                line_item_view.renderInline();
                loaded_adgroups++;
                if (loaded_adgroups == adgroup_keys.length) {
                    initializeTargetingTable()
                }
            });
            line_item.fetch()
        })
    };
    var initializeAppModal = function(data) {
        bootstrap_data = {
            external_key: data.app_key
        };
        var app = new AppForForm(bootstrap_data);
        var appForm = new AppForm({
            el: "#app-form-modal .modal-body",
            model: app
        });
        app.fetch();
        appForm.render();
        $("#app-form-modal-submit").on("click", function(e) {
            if (!appForm.validateCoppa()) {
                return
            }
            var xhr = appForm.submitHandler();
            mopub.Utils.disableUntilFinished(this, xhr)
        });
        appForm.on("close", utils.redirectOrReload)
    };
    var initializeAdunitModal = function(data) {
        bootstrap_data = {
            id: data.adunit_key,
            external_key: data.adunit_key,
            app_external_key: data.app_key
        };
        var adunit = new AdUnitForForm(bootstrap_data);
        var app = new AppForForm({
            external_key: bootstrap_data.app_external_key
        });
        app.fetch();
        var rewardedVideoCurrencyCollection = new RewardedVideoCurrencyCollection;
        var fetchRewardedVideoCurrencyCollection = function() {
            rewardedVideoCurrencyCollection.fetch({
                success: function() {
                    adunitForm.render()
                }
            })
        };
        fetchRewardedVideoCurrencyCollection();
        var adunitForm = new AdUnitForm({
            el: "#adunit-form-modal .modal-body",
            model: adunit,
            app: app,
            rewardedVideoCurrencyCollection: rewardedVideoCurrencyCollection,
            fetchRewardedVideoCurrencyCollection: fetchRewardedVideoCurrencyCollection
        });
        if (!adunit.isNew()) {
            adunit.fetch()
        }
        adunitForm.render();
        $("#adunit-form-modal-submit").on("click", function(e) {
            var xhr = adunitForm.submitHandler();
            mopub.Utils.disableUntilFinished(this, xhr)
        });
        adunitForm.on("close", utils.redirectOrReload);
        preloadImages()
    };
    var utils = exports.utils = {
        redirectOrReload: function(data) {
            if (data && _.has(data, "url")) {
                window.location.href = data.url
            } else {
                window.location.reload()
            }
        }
    };
    exports.PublisherController = {
        initializeIndex: function(bootstrapping_data) {
            var pageShim = DataShim(window.DATA_SERVICE_OPTIONS).get_inventory(bootstrapping_data.adunit_mapping);
            var ShimmedApp = shims.shimmedAppModelFactory(pageShim);
            var apps = new AppCollection;
            apps.bind("loaded", function() {
                var chart_view = new CollectionChartView({
                    collection: apps,
                    start_date: bootstrapping_data.start_date,
                    display_values: ["req", "imp", "fill_rate", "clk", "ctr"]
                });
                chart_view.render();
                $("#app_table").tablesorter({
                    sortList: [
                        [3, 1]
                    ],
                    sortInitialOrder: "desc"
                });
                $("#adunit_table").tablesorter({
                    sortList: [
                        [3, 1]
                    ],
                    sortInitialOrder: "desc"
                })
            });
            var fetched_apps = 0;
            _.each(bootstrapping_data.app_keys, function(app_key) {
                var app = new ShimmedApp({
                    id: app_key,
                    include_daily: true,
                    include_adunits: true,
                    start_date: bootstrapping_data.start_date,
                    date_range: bootstrapping_data.date_range
                });
                app.bind("change", function() {
                    var app_view = new AppView({
                        model: app,
                        el: ".publisher_table"
                    });
                    app_view.renderInline();
                    fetched_apps++;
                    if (fetched_apps == apps.length) {
                        apps.trigger("loaded")
                    }
                });
                app.fetch({
                    error: function() {
                        app.fetch({
                            error: toast_error
                        })
                    }
                });
                apps.add(app)
            });
            $("#app-quick-navigate").chosen().change(function() {
                window.location = $(this).val()
            });
            var apps_table = new Filters.FilteredTableView({
                el: "#apps-filtered-table",
                button_el: "#apps-filter-buttons-placeholder",
                filter_groups: Filters.AppFilterGroups
            });
            apps_table.render();
            $("#app_table").stickyTableHeaders();
            apps_table.$("th.fill-rate-column").tooltip({
                title: FILL_RATE_TOOLTIP_TEXT_APP,
                container: "body"
            });
            var adunits_table = new Filters.FilteredTableView({
                el: "#adunits-filtered-table",
                button_el: "#adunits-filter-buttons-placeholder",
                filter_groups: Filters.AdUnitFilterGroups
            });
            adunits_table.render();
            $("#adunit_table").stickyTableHeaders();
            adunits_table.$("th.fill-rate-column").tooltip({
                title: FILL_RATE_TOOLTIP_TEXT_ADUNIT,
                container: "body"
            })
        },
        initializeAppDetail: function(bootstrapping_data) {
            var pageShim = DataShim(window.DATA_SERVICE_OPTIONS).get_app_detail(bootstrapping_data.adunit_mapping, bootstrapping_data.line_item_keys, bootstrapping_data.marketplace_campaign_key);
            initializeDeleteForm();
            initializeAdunitModal(bootstrapping_data);
            initializeAppModal(bootstrapping_data);
            var adunits_table = new Filters.FilteredTableView({
                el: "#adunits-filtered-table",
                button_el: "#adunits-filter-buttons-placeholder",
                filter_groups: Filters.AdUnitFilterGroups
            });
            adunits_table.render();
            var line_items_table = new Filters.FilteredTableView({
                el: "#line-items-filtered-table",
                button_el: "#line-items-filter-buttons-placeholder",
                filter_groups: Filters.getLineItemFilterGroups()
            });
            line_items_table.render();
            $("#targeting_table").stickyTableHeaders();
            var ShimmedApp = shims.shimmedAppModelFactory(pageShim);
            var app = new ShimmedApp({
                id: bootstrapping_data.app_key,
                include_daily: true,
                include_adunits: true,
                start_date: bootstrapping_data.start_date,
                date_range: bootstrapping_data.date_range
            });
            app.bind("change", function() {
                var app_view = new AppView({
                    model: app,
                    el: ".publisher_table"
                });
                app_view.renderInline();
                var apps = new AppCollection;
                apps.add(app);
                var chart_view = new CollectionChartView({
                    collection: apps,
                    start_date: bootstrapping_data.start_date,
                    display_values: ["req", "imp", "fill_rate", "clk", "ctr"]
                });
                chart_view.render();
                $("#adunit_table").tablesorter({
                    sortList: [
                        [3, 1]
                    ],
                    sortInitialOrder: "desc"
                });
                initializeTargetingTable()
            });
            app.fetch({
                error: function() {
                    app.fetch({
                        error: toast_error
                    })
                }
            });
            loadAdgroupStats(bootstrapping_data.line_item_keys, bootstrapping_data.start_date, bootstrapping_data.date_range, bootstrapping_data.app_key, null, pageShim);
            var CampaignShim = shims.shimmedCampaignModelFactory(pageShim);
            var marketplace_campaign = new CampaignShim({
                id: bootstrapping_data.marketplace_campaign_key,
                app: bootstrapping_data.app_key,
                start_date: bootstrapping_data.start_date,
                date_range: bootstrapping_data.date_range
            });
            var marketplace_campaign_view = new CampaignView({
                model: marketplace_campaign,
                el: ".advertiser_table"
            });
            marketplace_campaign.bind("change", function() {
                marketplace_campaign_view.renderInline();
                initializeTargetingTable()
            });
            marketplace_campaign.fetch();
            _.each(bootstrapping_data.network_item_keys, function(network_item_key) {
                TooltipMixin.createPopover(network_item_key)
            });
            var data_service_query = this.makeNetworkAppDataServiceQuery(bootstrapping_data);
            data_service_query.done(function(response) {
                _.each(response.results.by_campaign.rows, function(row) {
                    var backbone_id = row[0].value,
                        impressions = row[1].value,
                        revenue = row[2].value,
                        clicks = row[3].value,
                        ctr = row[4].value,
                        ecpm = row[5].value;
                    $("#" + backbone_id + " .imp").html(mopub.Utils.formatNumberWithCommas(impressions));
                    $("#" + backbone_id + " .clk").html(mopub.Utils.formatNumberWithCommas(clicks));
                    $("#" + backbone_id + " .ctr").html(mopub.Utils.formatNumberAsPercentage(ctr))
                });
                $("tr.network .loading-img").hide()
            })
        },
        makeNetworkAppDataServiceQuery: function(options) {
            var query = mopub.utilities.Query(window.DATA_SERVICE_OPTIONS).metrics("impressions", "clicks", "revenue", "ctr", "ecpm").filters(["adgroup_type", "=", "network"], ["app", "=", options.app_key]).aggregations(["by_campaign", ["campaign"], false]);
            return query.execute()
        },
        initializeAdunitDetail: function(bootstrapping_data) {
            var pageShim = DataShim(window.DATA_SERVICE_OPTIONS).get_adunit_detail(bootstrapping_data.adunit_key, bootstrapping_data.adgroup_keys);
            initializeDeleteForm();
            initializeAdunitModal(bootstrapping_data);
            var line_items_table = new Filters.FilteredTableView({
                el: "#line-items-filtered-table",
                button_el: "#line-items-filter-buttons-placeholder",
                filter_groups: Filters.getLineItemFilterGroups()
            });
            line_items_table.render();
            $("#targeting_table").stickyTableHeaders();
            var ShimmedAdUnit = shims.shimmedAdUnitModelFactory(pageShim);
            var adunit = new ShimmedAdUnit({
                id: bootstrapping_data.adunit_key,
                include_daily: true,
                start_date: bootstrapping_data.start_date,
                date_range: bootstrapping_data.date_range
            });
            adunit.bind("change", function() {
                var adunits = new AdUnitCollection;
                adunits.add(adunit);
                var chart_view = new CollectionChartView({
                    collection: adunits,
                    start_date: bootstrapping_data.start_date,
                    display_values: ["req", "imp", "fill_rate", "clk", "ctr"]
                });
                chart_view.render()
            });
            adunit.fetch({
                error: function() {
                    adunit.fetch({
                        error: toast_error
                    })
                }
            });
            loadAdgroupStats(bootstrapping_data.adgroup_keys, bootstrapping_data.start_date, bootstrapping_data.date_range, undefined, bootstrapping_data.adunit_key, pageShim)
        },
        initializeAppCreate: function(bootstrapping_data) {
            var rewardedVideoCurrencyCollection = new RewardedVideoCurrencyCollection;
            var fetchRewardedVideoCurrencyCollection = function() {
                rewardedVideoCurrencyCollection.fetch({
                    success: function() {
                        appAndAdUnitForm.renderAdUnitForm()
                    }
                })
            };
            fetchRewardedVideoCurrencyCollection();
            var appAndAdUnitForm = new AppAndAdUnitForm({
                el: "#app-and-adunit-form",
                rewardedVideoCurrencyCollection: rewardedVideoCurrencyCollection,
                fetchRewardedVideoCurrencyCollection: fetchRewardedVideoCurrencyCollection
            });
            appAndAdUnitForm.render();
            $("#app-form-submit").on("click", function(e) {
                var xhr = appAndAdUnitForm.submit();
                mopub.Utils.disableUntilFinished(this, xhr)
            });
            appAndAdUnitForm.on("close", utils.redirectOrReload);
            preloadImages();
            return appAndAdUnitForm
        }
    }
});
(function() {
    ALL_DIMENSIONS = {
        app: "App",
        adunit: "Ad Unit",
        int_priority: "Priority",
        type: "Line Item Type",
        campaign: "Order",
        adgroup: "Line Item",
        creative: "Creative",
        month: "Month",
        week: "Week",
        day: "Day",
        hour: "Hour",
        country: "Country",
        os: "OS",
        marketing: "Device"
    };
    if (mopub.gargoyle.isSwitchEnabled("reports_city_targeting")) {
        ALL_DIMENSIONS["city"] = "City"
    }
    var MAX_DIMENSIONS = 6;
    var ONE_DAY = 1e3 * 60 * 60 * 24;
    var DEFAULT_DIMENSION_TEXT = "Select specific items to report on.";
    var UNFILTERABLE_DIMENSION_TEXT = "Individual break downs are not available for this filter. Your report will show all the available data for this filter.";
    NetworkReportingDataFreshnessView = Backbone.Marionette.ItemView.extend({
        render: function() {
            var $message = $(this.el).find(".data-freshness"),
                url = $message.data("update-url");
            if ($message && url) {
                $.get(url, function(data) {
                    $message.text(data)
                })
            }
        }
    });
    DateRangeView = Backbone.Marionette.ItemView.extend({
        ui: function(options) {
            return {
                interval: "#id_" + this.prefix + "-interval",
                start: "#id_" + this.prefix + "-start",
                end: "#id_" + this.prefix + "-end",
                sched_interval: "#id_" + this.prefix + "-sched_interval"
            }
        },
        events: {
            "change .date": "setCustom",
            "change #schedule-dropdown": "changeScheduleNote"
        },
        initialize: function(options) {
            this.delivery_time = options.delivery_time;
            this.prefix = options.prefix || "new";
            this.events["change #id_" + this.prefix + "-interval"] = "changeInterval";
            this.events["change #id_" + this.prefix + "-sched_interval"] = "changeSchedInterval";
            this.changeScheduleNote();
            this.delegateEvents()
        },
        changeScheduleNote: function() {
            var val = this.$("#schedule-dropdown").val();
            var $note = this.$("#schedule-note");
            if (val === "none") {
                $note.text("This report will not run automatically.")
            } else if (val === "daily") {
                $note.text("This report will run and deliver to recipients daily at " + this.delivery_time + ".")
            } else if (val === "weekly") {
                $note.text("This report will run and deliver to recipients on Monday of each week at " + this.delivery_time + ".")
            } else if (val === "monthly") {
                $note.text("This report will run and deliver to recipients on the first day of each month at " + this.delivery_time + ".")
            } else if (val === "quarterly") {
                $note.text("This report will run and deliver to recipients on the first day of each quarter at " + this.delivery_time + ".")
            }
        },
        setCustom: function() {
            this.ui.interval.val("custom").trigger("chosen:updated")
        },
        changeSchedInterval: function() {
            _.each(["daily", "weekly", "monthly", "quarterly"], function(interval) {
                this.$("#" + this.prefix + "-schedule-help-" + interval).hide()
            });
            this.$("#" + this.prefix + "-schedule-help-" + this.ui.sched_interval.val()).show()
        },
        changeInterval: function() {
            var val = this.ui.interval.val();
            if (val != "custom") {
                var date = new Date;
                switch (val) {
                    case "yesterday":
                        date.setTime(date.getTime() - ONE_DAY);
                        var start = date.format("mm/dd/yyyy");
                        var end = start;
                        break;
                    case "7days":
                        date.setTime(date.getTime() - ONE_DAY);
                        end = date.format("mm/dd/yyyy");
                        date.setTime(date.getTime() - 6 * ONE_DAY);
                        start = date.format("mm/dd/yyyy");
                        break;
                    case "lmonth":
                        var this_mo = date.getMonth();
                        while (date.getMonth() == this_mo) {
                            date.setTime(date.getTime() - ONE_DAY)
                        }
                        end = date.format("mm/dd/yyyy");
                        date.setDate(1);
                        start = date.format("mm/dd/yyyy");
                        break
                }
                this.ui.start.datepicker("update", start);
                this.ui.end.datepicker("update", end)
            }
        },
        onRender: function() {
            this.ui.start.datepicker();
            this.ui.end.datepicker()
        },
        render: function() {
            this.isClosed = false;
            this.triggerMethod("before:render", this);
            this.triggerMethod("item:before:render", this);
            var data = this.serializeData();
            data = this.mixinTemplateHelpers(data);
            this.bindUIElements();
            this.triggerMethod("render", this);
            this.triggerMethod("item:rendered", this);
            this.changeInterval();
            return this
        }
    });
    var breakdownView;
    var clearFields = function() {
        $("#new-reportEditForm")[0].reset();
        $("#id_new-interval").change();
        breakdownView.children.findByIndex(0).trigger("selection:changed")
    };
    var freshness_view = new NetworkReportingDataFreshnessView({
        el: "#nrnew-networks-reportEditForm"
    });
    window.ReportIndexController = {
        initialize: function(bootstrapping_data) {
            breakdownView = new BreakdownView({
                el: "#new-reportEditForm .report-breakdown"
            });
            new DateRangeView({
                el: "#new-reportEditForm",
                delivery_time: "2:00 PM UTC (7:00 AM PDT)"
            }).render();
            new DateRangeView({
                el: "#nrnew-networks-reportEditForm",
                prefix: "nrnew",
                delivery_time: "5:00 PM UTC (10:00 AM PDT)"
            }).render();
            breakdownView.render();
            setUpReportsForm("new");
            setUpNetworksReportsForm("nrnew");
            setUpApiAccessForm();
            setUpApiDetailsModal();
            $("#reports-reportAddForm").on("hidden", clearFields);
            $("#id_new-interval").change();
            _.each(bootstrapping_data.report_keys, function(key) {
                var row = $("#" + key + "-row");
                $(row).mouseenter(function(e) {
                    $("#" + key + "-edit-link").show()
                });
                $(row).mouseleave(function(e) {
                    $("#" + key + "-edit-link").hide()
                })
            });
            $("#reportStateChangeForm-delete").click(function(e) {
                e.preventDefault();
                $("#reportStateChangeForm").find("#action").val("delete").end().submit()
            })
        }
    };
    BreakdownView = Backbone.View.extend({
        initialize: function(options) {
            this.children = new Backbone.ChildViewContainer;
            _.each(_.range(0, 6), function(i) {
                var view = new DimensionView({
                    el: $(".report-dimension-" + (i + 1), $(this.options.el)),
                    column: i + 1,
                    report_external_key: options.report_external_key
                });
                this.listenTo(view, "selection:changed", this.childSelectionChanged);
                this.children.add(view)
            }, this);
            var currentlySelected = this.getSelectedDimensions();
            var available_options = _.difference(_.keys(ALL_DIMENSIONS), currentlySelected);
            this.children.each(function(element, index) {
                element.updateAvailableDimensions(_.compact(available_options.concat([currentlySelected[index]])))
            });
            if (this.getSelectedDimensions().length <= MAX_DIMENSIONS - 1) {
                this.children.findByIndex(this.getSelectedDimensions().length).enable()
            }
        },
        getSelectedDimensions: function() {
            return _.compact(this.children.invoke("selected"))
        },
        childSelectionChanged: function(changedView, value) {
            var selections = this.getSelectedDimensions();
            var childIndex = this.children.indexOf(changedView) + 1;
            _.each(this.children.rest(childIndex), function(subsequent_view) {
                subsequent_view.reset(selections)
            });
            var rest = this.children.rest(childIndex);
            if (rest.length) {
                rest[0].enable()
            }
        }
    });
    DimensionView = Backbone.View.extend({
        intervals: {
            hour: "hourly",
            day: "daily",
            week: "weekly",
            month: "monthly"
        },
        interval_examples: {
            hour: "2013-03-01 11:00 AM<br/>2013-03-01 12:00 PM<br/>2013-03-01 1:00 PM<br/>etc.",
            day: "2013-03-01<br/>2013-03-02<br/>2013-03-03<br/>etc.",
            week: "2013-03-03 - 2013-03-09<br/>2013-03-10 - 2013-03-16<br/>2013-03-17 - 2013-03-23<br/>etc.",
            month: "2013-03<br/>2013-04<br/>2013-05<br/>etc."
        },
        filterables: ["app", "adunit", "campaign", "adgroup", "creative", "int_priority", "type", "country", "os"],
        unfilterables: ["marketing", "city"],
        initialize: function(options) {
            this.$select = this.$("select");
            this.$dimension_filter = this.$(".dimension-filter");
            var selected_dimension = this.$select.val();
            this.report_external_key = options.report_external_key || "new";
            this.setFilterContent(selected_dimension)
        },
        events: {
            "change select": "change"
        },
        setFilterContent: function(dimension) {
            this.clearDimensionFilter();
            if (_.contains(_.keys(this.intervals), dimension)) {
                this.setIntervalText(dimension)
            } else if (_.contains(this.filterables, dimension)) {
                this.setFilterableChoices(dimension)
            } else if (_.contains(this.unfilterables, dimension)) {
                this.showUnfilterableText()
            } else {
                this.showDefaultText()
            }
        },
        showDefaultText: function() {
            this.$dimension_filter.text(DEFAULT_DIMENSION_TEXT).addClass("default-dimension-text")
        },
        showUnfilterableText: function() {
            this.$dimension_filter.text(UNFILTERABLE_DIMENSION_TEXT).addClass("default-dimension-text")
        },
        setIntervalText: function(interval) {
            var text = "Your report will be broken out into " + this.intervals[interval] + " intervals.";
            text += "<br>" + this.interval_examples[interval];
            this.$dimension_filter.html(text)
        },
        setFilterableChoices: function(filterable) {
            var that = this;
            var $dimension_filter = this.$dimension_filter;
            if (_.contains(this.filterables, filterable)) {
                $dimension_filter.html('<img class="spinner" src="/public/images/ajax-loader.gif">');
                $.get("/reports/custom/report_form/" + this.report_external_key + "/" + filterable + "/").success(function(response) {
                    $dimension_filter.html(response);
                    $dimension_filter.find("ul").prepend("<li><label><b>" + '<input type="checkbox" class="select-all">' + " Select All" + "</b></label></li>");
                    $dimension_filter.find(".select-all").click(function() {
                        that.disableIndividualInputs($dimension_filter, $(this).prop("checked"))
                    });
                    var checkedIndividualInputs = $dimension_filter.find("input:checked").not(".select-all");
                    if (that.report_external_key === "new" || !checkedIndividualInputs.length) {
                        $dimension_filter.find(".select-all").prop("checked", true);
                        that.disableIndividualInputs($dimension_filter, true)
                    }
                })
            }
        },
        clearDimensionFilter: function() {
            this.$dimension_filter.empty().removeClass("default-dimension-text")
        },
        disableIndividualInputs: function(parentElement, disable) {
            parentElement.find("input").not(".select-all").prop("disabled", disable)
        },
        change: function() {
            var selected_dimension = this.$select.val();
            this.trigger("selection:changed", this, selected_dimension);
            this.setFilterContent(selected_dimension)
        },
        enable: function() {
            this.$select.prop("disabled", "")
        },
        disable: function() {
            this.$select.prop("disabled", "disabled");
            this.$select.val([])
        },
        selected: function() {
            return this.$select.val()
        },
        dimensions: function() {
            return _.map(this.$select.find("option"), function(elem) {
                return $(elem).attr("value")
            })
        },
        updateAvailableDimensions: function(available) {
            var selected = this.selected();
            this.$select.empty();
            this.$select.append("<option value=''> Column " + this.options.column + " </option>");
            _.each(available, function(new_option) {
                this.$select.append("<option value='" + new_option + "'>" + ALL_DIMENSIONS[new_option] + "</option>")
            }, this);
            this.$select.val(selected)
        },
        reset: function(disabled_dimensions) {
            this.disable();
            if (_.isUndefined(disabled_dimensions)) {
                disabled_dimensions = []
            }
            var still_available_options = _.difference(_.keys(ALL_DIMENSIONS), disabled_dimensions);
            this.updateAvailableDimensions(still_available_options);
            this.$select.val(-1);
            this.showDefaultText();
            return this
        }
    });
    window.setUpReportsForm = function(prefix) {
        var save_btn = $("#" + prefix + "-reportEditForm-run, #" + prefix + "-reportEditForm-save");
        var spinner = $("#submit-spinner");
        var help_text = $("#form-help-text");
        var reportForm = $("#{}-reportEditForm".format(prefix));
        var validator = reportForm.validate({
            errorPlacement: function(error, element) {
                element.parents("div").not(":hidden").first().append(error)
            },
            submitHandler: function(form) {
                spinner.removeClass("hidden");
                var xhr = mopub.Utils.ajaxUpload(form).done(function(data) {
                    window.location = data.redirect
                }).fail(function(data) {
                    if (data.status === 403) {
                        reportForm.append(data.errors[0]).css("color", "red")
                    } else {
                        if (data.errors && data.errors.hasOwnProperty("new-start")) {
                            data.errors["new-end"] = ""
                        }
                        validator.showErrors(data.errors)
                    }
                }).always(function() {
                    spinner.addClass("hidden")
                });
                mopub.Utils.disableUntilFinished(save_btn, xhr)
            }
        });
        $("select[name=" + prefix + "-sched_interval]").change(function(e) {
            var $runButton = document.getElementById(prefix + "-reportEditForm-run");
            if (e.currentTarget.value === "none") {
                $runButton.removeAttribute("disabled")
            } else {
                $runButton.setAttribute("disabled", "disabled")
            }
        });
        $("#" + prefix + "-reportEditForm-run").click(function(e) {
            e.preventDefault();
            if (e.currentTarget.getAttribute("disabled") === "disabled") {
                return
            }
            $("#id_" + prefix + "-saved").attr("checked", false);
            $("#" + prefix + "-reportEditForm").submit()
        });
        $("#" + prefix + "-reportEditForm-save").click(function(e) {
            e.preventDefault();
            $("#id_" + prefix + "-saved").attr("checked", true);
            $("#" + prefix + "-reportEditForm").submit()
        })
    };
    window.setUpNetworksReportsForm = function(prefix) {
        var save_btn = $("#" + prefix + "-networks-reportEditForm-run, #" + prefix + "-networks-reportEditForm-save");
        var spinner = $("#networks-submit-spinner");
        var reportForm = $("#{}-networks-reportEditForm".format(prefix));
        var form_level_error = $("#networks-form-errors");
        $("#{}-networks-reportEditForm .chosen-select".format(prefix)).chosen({
            width: "372px"
        });
        var validator = reportForm.validate({
            errorPlacement: function(error, element) {
                element.parents("div").not(":hidden").first().append(error)
            },
            submitHandler: function(form) {
                spinner.removeClass("hidden");
                form_level_error.html("");
                var xhr = mopub.Utils.ajaxUpload(form).done(function(data) {
                    window.location = data.redirect
                }).fail(function(data) {
                    if (data.status === 403) {
                        reportForm.append(data.errors[0]).css("color", "red")
                    } else {
                        if (form_level_error && data.errors && data.errors[prefix + "-__all__"]) {
                            form_level_error.html(data.errors[prefix + "-__all__"]);
                            delete data.errors[prefix + "-__all__"]
                        }
                        validator.showErrors(data.errors)
                    }
                }).always(function() {
                    spinner.addClass("hidden")
                });
                mopub.Utils.disableUntilFinished(save_btn, xhr)
            }
        });
        var getMixpanelScheduledProperty = function() {
            var selects = document.querySelectorAll("select[name=" + prefix + "-sched_interval]");
            if (selects.length == 1) {
                return selects[0].value === "none" ? "False" : "True"
            }
            return "Unknown"
        };
        var getMixpanelAdSourceFilter = function() {
            var selects = document.querySelectorAll("select[name=" + prefix + "-network_filters]");
            if (selects.length == 1) {
                return selects[0].value === "" ? "False" : "True"
            }
            return "Unknown"
        };
        var getMixpanelCountryFilter = function() {
            var selects = document.querySelectorAll("select[name=" + prefix + "-country_filters]");
            if (selects.length == 1) {
                return selects[0].value === "" ? "False" : "True"
            }
            return "Unknown"
        };
        var getMixpanelProperties = function() {
            return {
                scheduled: getMixpanelScheduledProperty(),
                adSourceFilter: getMixpanelAdSourceFilter(),
                countryFilter: getMixpanelCountryFilter()
            }
        };
        $("select[name=" + prefix + "-sched_interval]").change(function(e) {
            var $runButton = document.getElementById(prefix + "-networks-reportEditForm-run");
            if (e.currentTarget.value === "none") {
                $runButton.removeAttribute("disabled")
            } else {
                $runButton.setAttribute("disabled", "disabled")
            }
        });
        $("#" + prefix + "-networks-reportEditForm-run").click(function(e) {
            e.preventDefault();
            if (e.currentTarget.getAttribute("disabled") === "disabled") {
                return
            }
            $("#id_" + prefix + "-saved").attr("checked", false);
            $("#" + prefix + "-networks-reportEditForm").submit();
            mixpanel.track("Network reporting dialog - Saved", getMixpanelProperties())
        });
        $("#" + prefix + "-networks-reportEditForm-save").click(function(e) {
            e.preventDefault();
            $("#id_" + prefix + "-saved").attr("checked", true);
            $("#" + prefix + "-networks-reportEditForm").submit();
            mixpanel.track("Network reporting dialog - Saved", getMixpanelProperties())
        });
        $("#" + prefix + "-reportForm-container").on("shown", function(e) {
            mixpanel.track("Network reporting dialog - Opened")
        });
        $("#" + prefix + "-networks-reportEditForm-cancel").click(function(e) {
            e.preventDefault();
            mixpanel.track("Network reporting dialog - Closed", getMixpanelProperties())
        })
    };
    $("#nrnew-reportForm-container").on("shown", function() {
        freshness_view.render()
    });
    window.setUpApiAccessForm = function() {
        var apiEnabledForm = $("#api-apiAccessForm");
        var spinner = $("#api-apiAccessSpinner");
        var checkbox = $("#id_api-api_enabled");
        spinner.addClass("hidden");
        var validator = apiEnabledForm.validate({
            submitHandler: function(form) {
                spinner.removeClass("hidden");
                var xhr = mopub.Utils.ajaxUpload(form).done(function(data) {
                    Toast.success(data.flash);
                    location.reload(true)
                }).fail(function(data) {
                    Toast.error(data.flash)
                }).always(function() {
                    spinner.addClass("hidden")
                })
            }
        });
        checkbox.on("change", function(e) {
            spinner.removeClass("hidden");
            apiEnabledForm.submit()
        })
    };
    window.setUpApiDetailsModal = function() {
        function switchFooterToState(stateName) {
            $(".footer-state").addClass("hidden");
            $(".reset-api-key").removeClass("is-disabled");
            $(".reset-api-key-cancel").removeClass("is-disabled");
            $(".reset-api-key-spinner").addClass("hidden");
            $("#api-key-checkmark").addClass("hidden");
            if (stateName === "initial") {
                $("#footer-state-initial").removeClass("hidden")
            } else if (stateName === "confirmation") {
                $("#footer-state-confirmation").removeClass("hidden")
            } else if (stateName === "error") {
                $("#footer-state-error").removeClass("hidden")
            } else if (stateName === "success") {
                $("#footer-state-success").removeClass("hidden");
                $("#api-key-checkmark").removeClass("hidden")
            } else {
                throw new Error("Invalid stateName passed to switchFooterToState().")
            }
        }

        function switchFooterToRequestPendingState() {
            $(".reset-api-key").addClass("is-disabled");
            $(".reset-api-key-cancel").addClass("is-disabled");
            $(".reset-api-key-spinner").removeClass("hidden")
        }
        $("#api-apiAccessReportIds").on("shown", function() {
            switchFooterToState("initial")
        });
        $("#reset-api-key-initial").click(function(e) {
            switchFooterToState("confirmation")
        });
        $(".reset-api-key").click(function(e) {
            if (!$(e.delegateTarget).hasClass("is-disabled")) {
                switchFooterToRequestPendingState();
                $.ajax({
                    url: "/reports/custom/reset_api_key/",
                    timeout: 12e3,
                    type: "POST",
                    dataType: "json"
                }).done(function(response_json) {
                    $("#api-key").text(response_json.new_api_key);
                    switchFooterToState("success")
                }).fail(function(xhr, status, errorThrown) {
                    switchFooterToState("error")
                })
            }
        });
        $(".reset-api-key-cancel").click(function(e) {
            if (!$(e.delegateTarget).hasClass("is-disabled")) {
                switchFooterToState("initial")
            }
        })
    }
}).call(this);
