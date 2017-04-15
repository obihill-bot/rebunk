/*! Core */

/*! Critical JavaScript. Load in <head> using <script> with async attribute */
/*jshint -W097 */
/*jshint -W117 */
/*jshint devel: true, plusplus: false, nonew: false*/
/* global process, self, global, module, window, amplify, XMLHttpRequest, ActiveXObject, console */
"use strict";
(function(window, document, $, _r){

    (function(root, name, make){
        var $ = (root.jQuery || root.Zepto) ? root.jQuery || root.Zepto : root.$;
        if (typeof module !== 'undefined' && module.exports){ module.exports = make($);}
        else {root[name] = make($);}
    }(window, 'rebunk', function($) {

        /**
         * Main initialization function for rebunk
         */
        var init = function()
        {
            //set incrementer for tests
            rScript.store('rb_test_counter_list', 1);
            rScript.store('rb_test_counter_all', 0);
            rScript.store('rb_test_counter_pass', 0);
            rScript.store('rb_test_counter_fail', 0);

            //start timer
            _startTimer();
        };

        /**
         * Marks the timer at the start of rebunk
         * @private
         */
        function _startTimer()
        {
            rScript.store('rb_timer_start', _r.microtime(true));
        }

        /**
         * Marks the time at the end of a rebunk test
         * @private
         */
        function _endTimer()
        {
            rScript.store('rb_timer_end', _r.microtime(true));
        }

        /**
         * Gets the timer difference
         * @private
         */
        function _diffTimer()
        {
            var start_timer_flt = parseFloat(rScript.store('rb_timer_start')),
                end_timer_flt = parseFloat(rScript.store('rb_timer_end')),
                diff_timer_flt
            ;

            diff_timer_flt = end_timer_flt - start_timer_flt;
            diff_timer_flt = Math.round((diff_timer_flt + 0.00001) * 1000) / 1000;

            return diff_timer_flt;
        }

        /**
         * Displays the final summary of all tests including time elapsed
         * @private
         */
        function _displaySummary()
        {
            var config_obj = _getConfig(),
                diff_timer_flt = _diffTimer(),
                test_counter_all_str = rScript.store('rb_test_counter_all'),
                test_counter_all_int = parseInt(test_counter_all_str),
                test_counter_pass_str = rScript.store('rb_test_counter_pass'),
                test_counter_fail_str = rScript.store('rb_test_counter_fail'),
                plural_suffix_str = (test_counter_all_int === 1) ? '' : 's'
                ;

            _r.console.log('\n%c'+test_counter_all_str+' Total Assertion'+plural_suffix_str+' \u2022 '+test_counter_pass_str+' Passed \u2022 '+test_counter_fail_str+' Failed \u2022 '+diff_timer_flt+'s', 'color:'+config_obj.colorSummary);
        }

        /**
         * Defines the configuration
         * @param {Object} config_obj the config object that defines rebunk
         * timeout: the summary timeout in milliseconds. Default is 5000
         * colorPass: the color of the test notification label that passes. Default is #008e00
         * colorFail: the color of the test notification label that fails. Default is #ff0000
         * colorFlag: the color of the flag notification message. Default is #888888
         * colorBody: the color of the main test notification. Default is #555555
         * colorHint: the color of the test notification hint. Default is #777777
         * colorSummary: the color of the test summary. Default is #555555
         * labelPass: the text value of the test notification label that passes. Default is 'Pass'
         * labelFail: the text value of the test notification label that fails. Default is 'Fail'
         * labelFlag: the text value of the flag notification. Default is 'Flag'
         * iconPass: the icon of the test notification label that passes: Default is '\u2714'
         * iconFail: the icon of the test notification label that fails: Default is '\u2718'
         * iconFlag: the icon of the flag notification: Default is '\u2757'
         */
        function config()
        {
            var myArgs = Array.prototype.slice.call(arguments),
                config_obj = (_r.isObject(myArgs[0])) ? myArgs[0]: {};

            //Timeout
            config_obj.timeout = (config_obj.timeout && _r.isNumber(config_obj.timeout)) ? config_obj.timeout : 5000;

            //Colors
            config_obj.colorPass = (config_obj.colorPass && _r.isString(config_obj.colorPass)) ? config_obj.colorPass : '#008e00';
            config_obj.colorFail = (config_obj.colorFail && _r.isString(config_obj.colorFail)) ? config_obj.colorFail : '#ff0000';
            config_obj.colorFlag = (config_obj.colorFlag && _r.isString(config_obj.colorFlag)) ? config_obj.colorFlag : '#888888';
            config_obj.colorBody = (config_obj.colorBody && _r.isString(config_obj.colorBody)) ? config_obj.colorBody : '#555555';
            config_obj.colorHint = (config_obj.colorHint && _r.isString(config_obj.colorHint)) ? config_obj.colorHint : '#777777';
            config_obj.colorSummary = (config_obj.colorSummary && _r.isString(config_obj.colorSummary)) ? config_obj.colorSummary : '#555555';

            //Labels
            config_obj.labelPass = (config_obj.labelPass && _r.isString(config_obj.labelPass)) ? config_obj.labelPass : 'Pass';
            config_obj.labelFail = (config_obj.labelFail && _r.isString(config_obj.labelFail)) ? config_obj.labelFail : 'Fail';
            config_obj.labelFlag = (config_obj.labelFlag && _r.isString(config_obj.labelFlag)) ? config_obj.labelFlag : 'Flag';

            //Icons
            config_obj.iconPass = (config_obj.iconPass && _r.isString(config_obj.iconPass)) ? config_obj.iconPass : '\u2714';
            config_obj.iconFail = (config_obj.iconFail && _r.isString(config_obj.iconFail)) ? config_obj.iconFail : '\u2718';
            config_obj.iconFlag = (config_obj.iconFlag && _r.isString(config_obj.iconFlag)) ? config_obj.iconFlag : '\u2757';


            //persist to object storage
            rScript.addObject('rb_config', config_obj, {namespace: 'rebunk_vars'});

            //flag to ensure dedup
            rScript.domStore('rb_config_flag_status', true);
        }

        /**
         * Gets the config object
         * If config object is not set, it will set with default values and then get
         * @returns {Object}
         * @private
         */
        function _getConfig()
        {
            var config_flag_status_bool = !!((rScript.domStore('rb_config_flag_status')));
            if(!config_flag_status_bool)
            {
                config();
            }
            return rScript.getObject('rb_config', {namespace: 'rebunk_vars'});
        }

        /**
         * Sets the stage for the test
         * @param {Object} condition_obj the thresholds under which the test must be conducted. If the conditions are not met, the test will always fail.
         * For example, you might want to perform a test that is valid only when a mobile device is used. In this case, when the device is not mobile, a flag should be thrown
         *
         * The following parameters can be defined:
         *
         * ua_regex: defines a regular expression to be applied on the user agent string
         * viewport_w: defines a viewport width threshold. If the current viewport width is above this threshold, the test will be flagged
         * viewport_h: defines a viewport height threshold. If the current viewport height is above this threshold, the test will be flagged
         * screen_w: defines a screen width threshold. If the current screen width is above this threshold, the test will be flagged
         * screen_h: defines a screen height threshold. If the current screen height is above this threshold, the test will be flagged
         * is_desktop: confines the test to a desktop device. If true, the test will be flagged if the device is not a desktop
         * is_tablet: confines the test to a tablet device. If true, the test will be flagged if the device is not a tablet
         * is_phone: confines the test to a smartphone device. If true, the test will be flagged if the device is not a smartphone
         * is_mobile: confines the test to a mobile device. If true, the test will be flagged if the device is not a mobile
         * is_nonmobile: confines the test to a non-mobile device. If true, the test will be flagged if the device is not a non-mobile
         * is_portrait: confines the test to a the portrait orientation. If true, the test will be flagged if the device is not in portrait orientation
         * is_landscape: confines the test to the landscape orientation. If true, the test will be flagged if the device is not in landscape orientation
         * formfactor: confines the test to a specific formfactor. Available options are 'phone', 'tablet', 'desktop', and 'tv'
         * os: confines the test to a specific OS. Available options are 'ios', 'android', 'blackberry', 'symbian', 'windows', 'mac', 'linux'
         *
         */
        function stage(condition_obj)
        {
            var config_obj,
                console_message_str,
                console_message_prefix_str,
                condition_failed_bool = false,
                condition_result_item_bool,
                condition_label_arr = [];

            //Show Header
            if(!rScript.domStore('rb_test_header'))
            {
                _r.console.log('%cRebunk Test Suite\n=================\n', 'color:#777777');

                rScript.domStore('rb_test_header', true);
            }

            //get config
            config_obj = _getConfig();

            //Manage condition
            if(_r.isObject(condition_obj))
            {
                //1. User Agent
                var condition_ua_regex_str = condition_obj.ua_regex,
                    ua_str,
                    ua_regex_obj
                    ;

                if(condition_ua_regex_str && _r.isString(condition_ua_regex_str))
                {
                    ua_str = rScript.getUserAgent();
                    ua_regex_obj = new RegExp(condition_ua_regex_str, "ig");
                    condition_result_item_bool = ua_regex_obj.test(ua_str);

                    if(!condition_result_item_bool)
                    {
                        condition_label_arr.push('User agent regular expression condition [\''+condition_ua_regex_str+'\'] does not match for the user agent [\''+ua_str+'\']');
                        condition_failed_bool = true;
                    }
                }

                //2. Viewport Width
                var condition_viewport_w_int = condition_obj.viewport_w,
                    viewport_w_int
                    ;

                if(condition_viewport_w_int && _r.isNumber(condition_viewport_w_int))
                {
                    viewport_w_int = rScript.viewportW();
                    condition_result_item_bool = ((viewport_w_int <= condition_viewport_w_int));

                    if(!condition_result_item_bool)
                    {
                        condition_label_arr.push('Viewport width ['+viewport_w_int+'] is greater than the specified threshold ['+condition_viewport_w_int+']');
                        condition_failed_bool = true;
                    }
                }

                //3. Viewport Height
                var condition_viewport_h_int = condition_obj.viewport_h,
                    viewport_h_int
                    ;

                if(condition_viewport_h_int && _r.isNumber(condition_viewport_h_int))
                {
                    viewport_h_int = rScript.viewportW();
                    condition_result_item_bool = ((viewport_h_int <= condition_viewport_h_int));

                    if(!condition_result_item_bool)
                    {
                        condition_label_arr.push('Viewport height ['+viewport_h_int+'] is greater than the specified threshold ['+condition_viewport_h_int+']');
                        condition_failed_bool = true;
                    }
                }

                //4. Screen Width
                var condition_screen_w_int = condition_obj.screen_w,
                    screen_w_int
                    ;

                if(condition_screen_w_int && _r.isNumber(condition_screen_w_int))
                {
                    screen_w_int = rScript.screenW();
                    condition_result_item_bool = ((screen_w_int <= condition_screen_w_int));

                    if(!condition_result_item_bool)
                    {
                        condition_label_arr.push('Screen width ['+screen_w_int+'] is greater than the specified threshold ['+condition_screen_w_int+']');
                        condition_failed_bool = true;
                    }
                }

                //5. Screen Height
                var condition_screen_h_int = condition_obj.screen_h,
                    screen_h_int
                    ;

                if(condition_screen_h_int && _r.isNumber(condition_screen_h_int))
                {
                    screen_h_int = rScript.screenW();
                    condition_result_item_bool = ((screen_h_int <= condition_screen_h_int));

                    if(!condition_result_item_bool)
                    {
                        condition_label_arr.push('Screen height ['+screen_h_int+'] is greater than the specified threshold ['+condition_screen_h_int+']');
                        condition_failed_bool = true;
                    }
                }

                //6. Is Desktop
                var condition_is_desktop_bool = condition_obj.is_desktop,
                    is_desktop_bool
                    ;

                if(_r.isBool(condition_is_desktop_bool))
                {
                    is_desktop_bool = rScript.isDesktop();
                    condition_result_item_bool = (is_desktop_bool === condition_is_desktop_bool);

                    if(!condition_result_item_bool)
                    {
                        condition_label_arr.push('This device is not a desktop');
                        condition_failed_bool = true;
                    }
                }

                //7. Is Tablet
                var condition_is_tablet_bool = condition_obj.is_tablet,
                    is_tablet_bool
                    ;

                if(_r.isBool(condition_is_tablet_bool))
                {
                    is_tablet_bool = rScript.isTablet();
                    condition_result_item_bool = (is_tablet_bool === condition_is_tablet_bool);

                    if(!condition_result_item_bool)
                    {
                        condition_label_arr.push('This device is not a tablet');
                        condition_failed_bool = true;
                    }
                }

                //8. Is Smartphone
                var condition_is_phone_bool = condition_obj.is_phone,
                    is_phone_bool
                    ;

                if(_r.isBool(condition_is_phone_bool))
                {
                    is_phone_bool = rScript.isPhone();
                    condition_result_item_bool = (is_phone_bool === condition_is_phone_bool);

                    if(!condition_result_item_bool)
                    {
                        condition_label_arr.push('This device is not a smartphone');
                        condition_failed_bool = true;
                    }
                }

                //9. Is Mobile
                var condition_is_mobile_bool = condition_obj.is_mobile,
                    is_mobile_bool
                    ;

                if(_r.isBool(condition_is_mobile_bool))
                {
                    is_mobile_bool = rScript.isMobile();
                    condition_result_item_bool = (is_mobile_bool === condition_is_mobile_bool);

                    if(!condition_result_item_bool)
                    {
                        condition_label_arr.push('This device is not a mobile');
                        condition_failed_bool = true;
                    }
                }

                //10. Is Non-Mobile
                var condition_is_non_mobile_bool = (condition_obj.is_nonmobile || condition_obj.is_non_mobile),
                    is_non_mobile_bool
                    ;

                if(_r.isBool(condition_is_non_mobile_bool))
                {
                    is_non_mobile_bool = rScript.isNonMobile();
                    condition_result_item_bool = (is_non_mobile_bool === condition_is_non_mobile_bool);

                    if(!condition_result_item_bool)
                    {
                        condition_label_arr.push('This device is a mobile');
                        condition_failed_bool = true;
                    }
                }

                //11. Is Portrait
                var condition_is_portrait_bool = condition_obj.is_portrait,
                    is_portrait_bool
                    ;

                if(_r.isBool(condition_is_portrait_bool))
                {
                    is_portrait_bool = rScript.isPortrait();
                    condition_result_item_bool = (is_portrait_bool === condition_is_portrait_bool);

                    if(!condition_result_item_bool)
                    {
                        condition_label_arr.push('This device is not in portrait orientation');
                        condition_failed_bool = true;
                    }
                }

                //12. Is Landscape
                var condition_is_landscape_bool = condition_obj.is_landscape,
                    is_landscape_bool
                    ;

                if(_r.isBool(condition_is_landscape_bool))
                {
                    is_landscape_bool = rScript.isLandscape();
                    condition_result_item_bool = (is_landscape_bool === condition_is_landscape_bool);

                    if(!condition_result_item_bool)
                    {
                        condition_label_arr.push('This device is not in landscape orientation');
                        condition_failed_bool = true;
                    }
                }

                //13. Form Factor
                var condition_formfactor_str = condition_obj.formfactor,
                    formfactor_str
                    ;

                if(condition_formfactor_str && _r.isString(condition_formfactor_str) && condition_formfactor_str.length > 0)
                {
                    formfactor_str = rScript.getFormFactor();
                    condition_result_item_bool = (formfactor_str === condition_formfactor_str);

                    if(!condition_result_item_bool)
                    {
                        condition_label_arr.push('Form-factor condition [\''+condition_formfactor_str+'\'] does not match with the device form-factor [\''+formfactor_str+'\']');
                        condition_failed_bool = true;
                    }
                }

                //14. Operating System
                var condition_os_str = (condition_obj.os || condition_obj.platform),
                    os_str
                    ;

                if(condition_os_str && _r.isString(condition_os_str) && condition_os_str.length > 0)
                {
                    os_str = rScript.getPlatform();
                    condition_result_item_bool = (os_str === condition_os_str);

                    if(!condition_result_item_bool)
                    {
                        condition_label_arr.push('OS condition [\''+condition_os_str+'\'] does not match with the device OS [\''+os_str+'\']');
                        condition_failed_bool = true;
                    }
                }
            }

            //compose condition message
            console_message_str = '%c';
            if(condition_failed_bool)
            {
                for(var i = 0; i < condition_label_arr.length; i++)
                {
                    console_message_prefix_str = (i === 0) ? '': '\n';
                    console_message_str += console_message_prefix_str+config_obj.iconFlag+' '+config_obj.labelFlag+': '+condition_label_arr[i];
                }

                //flag in session Storage
                rScript.domStore('rb_stage_flag_status', true);
            }

            _r.console.log(console_message_str, 'color:'+config_obj.colorFlag);
        }

        /**
         * Runs a test
         * @param {String} label_str the identifier of the specific test
         * @param {String} expect_str the expected value
         * @param {String} actual_str the actual value
         * @param {String} callfront_str This is the name of a function that should be called prior to the test running
         */
        function test(label_str, expect_str, actual_str)
        {
            var myArgs = Array.prototype.slice.call(arguments),
                test_id_temp_str = _r.md5(label_str),
                test_id_str,
                test_obj = {},
                console_icon_symbol_str,
                console_icon_color_str,
                console_icon_label_str,
                console_message_str,
                config_obj,
                stage_flag_status_bool
                ;

            //Show Header
            if(!rScript.domStore('rb_test_header'))
            {
                _r.console.log('%cRebunk Test Suite\n=================\n', 'color:#777777');

                rScript.domStore('rb_test_header', true);
            }

            //get config
            config_obj = _getConfig();

            //set timer if not set
            if(!rScript.domStore('rb_timer_test_summary'))
            {
                _r.console.log('set_timeout');
                _r.console.log(config_obj);

                //set timeout for timer
                setTimeout(function(){ _displaySummary();}, config_obj.timeout);

                rScript.domStore('rb_timer_test_summary', true);
            }

            //get stage flag status
            stage_flag_status_bool = !!((rScript.domStore('rb_stage_flag_status')));

            /**
            //generate test id
            test_id_str = 'rebunk_test_'+test_id_temp_str.slice(0, 8);

            //generate test object
            test_obj.label = label_str;
            test_obj.expect = expect_str;
            test_obj.actual = actual_str;

            //add to queue
            rScript.addObject(test_id_str, test_obj, 'rebunk_test_queue');
            **/

            //select message parameters based on test result
            if(expect_str === actual_str)
            {
                console_icon_symbol_str = config_obj.iconPass;
                console_icon_color_str = config_obj.colorPass;
                console_icon_label_str = config_obj.labelPass;

                //increment counter for passed tests
                rScript.storeIncrement('rb_test_counter_pass');
            }
            else
            {
                console_icon_symbol_str = config_obj.iconFail;
                console_icon_color_str = config_obj.colorFail;
                console_icon_label_str = config_obj.labelFail;

                //increment counter for failed tests
                rScript.storeIncrement('rb_test_counter_fail');
            }

            //change color if stage is flagged
            if(stage_flag_status_bool)
            {
                console_icon_color_str = config_obj.colorFlag;
            }

            //compose result message
            console_message_str = '%c'+console_icon_symbol_str+' '+console_icon_label_str+' %c\n'+rScript.store('rb_test_counter_list')+'. '+label_str+'\n'+'%cExpected value is \''+expect_str+'\' \u2022 Actual value is \''+actual_str+'\'';
            _r.console.log(console_message_str, 'color:'+console_icon_color_str+';font-weight: bold', 'color:'+config_obj.colorBody, 'color:'+config_obj.colorHint);

            //increment test counters
            rScript.storeIncrement('rb_test_counter_list');
            rScript.storeIncrement('rb_test_counter_all');

            //mark timer
            _endTimer();
        }

        var rebunk = {
            init: init(),
            config: config,
            stage: stage,
            test: test
        };

        return rebunk;
    }));

})(window, document, rQuery, _r);
