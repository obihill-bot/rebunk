describe('Unit Tests', function(){

    var html_fixture;

    beforeAll(function(){
        fixture.setBase('spec/fixture');
        html_fixture = fixture.load('unit.html');
    });

    afterAll(function(){
        fixture.cleanup();
    });


    describe('API Methods', function(){

        /**
         * Config
         */
        describe('Config', function(){

            var val_config_obj,
                is_config_obj_bool,
                is_config_obj_control_bool,
                val_config_obj_name_str,
                val_config_obj_name_control_str,
                val_config_obj_timeout_int,
                val_config_obj_timeout_control_int,
                val_config_obj_colorpass_str,
                val_config_obj_colorpass_control_str,
                val_config_obj_colorfail_str,
                val_config_obj_colorfail_control_str,
                val_config_obj_colorflag_str,
                val_config_obj_colorflag_control_str,
                val_config_obj_colorbody_str,
                val_config_obj_colorbody_control_str,
                val_config_obj_colorhint_str,
                val_config_obj_colorhint_control_str,
                val_config_obj_colorsummary_str,
                val_config_obj_colorsummary_control_str,
                val_config_obj_labelpass_str,
                val_config_obj_labelpass_control_str,
                val_config_obj_labelfail_str,
                val_config_obj_labelfail_control_str,
                val_config_obj_labelflag_str,
                val_config_obj_labelflag_control_str,
                val_config_obj_iconpass_str,
                val_config_obj_iconpass_control_str,
                val_config_obj_iconfail_str,
                val_config_obj_iconfail_control_str,
                val_config_obj_iconflag_str,
                val_config_obj_iconflag_control_str
                ;

            beforeAll(function(){
                rebunk.config();

                val_config_obj = rScript.getObject('rb_config', {namespace: 'rebunk_vars'});
                is_config_obj_bool = ((val_config_obj && _r.isObject(val_config_obj)));
                is_config_obj_control_bool = true;

                console.log(val_config_obj);

                val_config_obj_name_str = val_config_obj.name;
                val_config_obj_name_control_str = 'Main Test';

                val_config_obj_timeout_int = val_config_obj.timeout;
                val_config_obj_timeout_control_int = 5000;

                val_config_obj_colorpass_str = val_config_obj.colorPass;
                val_config_obj_colorpass_control_str = '#008e00';

                val_config_obj_colorfail_str = val_config_obj.colorFail;
                val_config_obj_colorfail_control_str = '#ff0000';

                val_config_obj_colorflag_str = val_config_obj.colorFlag;
                val_config_obj_colorflag_control_str = '#888888';

                val_config_obj_colorbody_str = val_config_obj.colorBody;
                val_config_obj_colorbody_control_str = '#555555';

                val_config_obj_colorhint_str = val_config_obj.colorHint;
                val_config_obj_colorhint_control_str = '#777777';

                val_config_obj_colorsummary_str = val_config_obj.colorSummary;
                val_config_obj_colorsummary_control_str = '#555555';

                val_config_obj_labelpass_str = val_config_obj.labelPass;
                val_config_obj_labelpass_control_str = 'Pass';

                val_config_obj_labelfail_str = val_config_obj.labelFail;
                val_config_obj_labelfail_control_str = 'Fail';

                val_config_obj_labelflag_str = val_config_obj.labelFlag;
                val_config_obj_labelflag_control_str = 'Flag';

                val_config_obj_iconpass_str = val_config_obj.iconPass;
                val_config_obj_iconpass_control_str = '\u2714';

                val_config_obj_iconfail_str = val_config_obj.iconFail;
                val_config_obj_iconfail_control_str = '\u2718';

                val_config_obj_iconflag_str = val_config_obj.iconFlag;
                val_config_obj_iconflag_control_str = '\u2757';

            });

            it('should check if rebunk config object is valid', function(){
                expect(is_config_obj_bool).toBe(is_config_obj_control_bool);
            });

            it('should check if rebunk config object default value for name is accurate', function(){
                expect(val_config_obj_name_str).toBe(val_config_obj_name_control_str);
            });

            it('should check if rebunk config object default value for timeout is accurate', function(){
                expect(val_config_obj_timeout_int).toBe(val_config_obj_timeout_control_int);
            });

            it('should check if rebunk config object default value for colorPass is accurate', function(){
                expect(val_config_obj_colorpass_str).toBe(val_config_obj_colorpass_control_str);
            });

            it('should check if rebunk config object default value for colorFail is accurate', function(){
                expect(val_config_obj_colorfail_str).toBe(val_config_obj_colorfail_control_str);
            });

            it('should check if rebunk config object default value for colorFlag is accurate', function(){
                expect(val_config_obj_colorflag_str).toBe(val_config_obj_colorflag_control_str);
            });

            it('should check if rebunk config object default value for colorBody is accurate', function(){
                expect(val_config_obj_colorbody_str).toBe(val_config_obj_colorbody_control_str);
            });

            it('should check if rebunk config object default value for colorHint is accurate', function(){
                expect(val_config_obj_colorhint_str).toBe(val_config_obj_colorhint_control_str);
            });

            it('should check if rebunk config object default value for colorSummary is accurate', function(){
                expect(val_config_obj_colorsummary_str).toBe(val_config_obj_colorsummary_control_str);
            });

            it('should check if rebunk config object default value for labelPass is accurate', function(){
                expect(val_config_obj_labelpass_str).toBe(val_config_obj_labelpass_control_str);
            });

            it('should check if rebunk config object default value for labelFail is accurate', function(){
                expect(val_config_obj_labelfail_str).toBe(val_config_obj_labelfail_control_str);
            });

            it('should check if rebunk config object default value for labelFlag is accurate', function(){
                expect(val_config_obj_labelflag_str).toBe(val_config_obj_labelflag_control_str);
            });

            it('should check if rebunk config object default value for iconPass is accurate', function(){
                expect(val_config_obj_iconpass_str).toBe(val_config_obj_iconpass_control_str);
            });

            it('should check if rebunk config object default value for iconFail is accurate', function(){
                expect(val_config_obj_iconfail_str).toBe(val_config_obj_iconfail_control_str);
            });

            it('should check if rebunk config object default value for iconFlag is accurate', function(){
                expect(val_config_obj_iconflag_str).toBe(val_config_obj_iconflag_control_str);
            });

        });

        /**
         * Stage
         */
        describe('Stage', function(){

            var stage_condition_obj = {},
                stage_flag_bool,
                stage_flag_control_bool;

            beforeAll(function(){

                stage_condition_obj.ua_regex = 'blank';
                stage_condition_obj.viewport_w = '100';
                stage_condition_obj.viewport_h = '100';
                stage_condition_obj.screen_w = '100';
                stage_condition_obj.screen_h = '100';
                stage_condition_obj.is_desktop = false;
                stage_condition_obj.is_tablet = true;
                stage_condition_obj.is_phone = true;
                stage_condition_obj.is_mobile = true;
                stage_condition_obj.is_nonmobile = true;
                stage_condition_obj.is_portrait = true;
                stage_condition_obj.is_landscape = true;
                stage_condition_obj.formfactor = 'tablet';
                stage_condition_obj.os = 'android';

                rebunk.stage(stage_condition_obj);

                stage_flag_bool = rScript.domStore('rb_stage_flag_status');
                stage_flag_control_bool = true;

            });

            it('should check if rebunk stage has run', function(){
                expect(stage_flag_bool).toBe(stage_flag_control_bool);
            });

        });

        /**
         * Test
         */
        describe('Test', function(){

            var test_flag_header_bool,
                test_flag_header_control_bool;

            beforeAll(function(){

                rebunk.config({timeout: 1000});
                rebunk.test('unit test pass', true, true);
                rebunk.test('unit test fail', true, false);

                test_flag_header_bool = rScript.domStore('rb_test_header');
                test_flag_header_control_bool = true;

            });

            it('should check if rebunk test has run', function(done){
                setTimeout(function(){
                    expect(test_flag_header_bool).toBe(test_flag_header_control_bool);
                    done();
                }, 4000);
            });

        });

    });

});