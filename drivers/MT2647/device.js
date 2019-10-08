'use strict';

const ZwaveDevice = require('homey-meshdriver').ZwaveDevice;

const TAMPER_TIMEOUT = 30*1000;

class DevoloMotionSensor extends ZwaveDevice {

	onMeshInit() {
        this.setCapabilityValue('alarm_tamper', false);

        this.registerReportListener('BASIC', 'BASIC_SET', report => {
            if (!report || !report.hasOwnProperty('Value')) return null;
            this.setCapabilityValue('alarm_motion', !!report.Value);
        });

        // This sensor does not send a timeout when the tamper period is over. Use a timeout to reset the capability
       this.registerReportListener('SENSOR_BINARY', 'SENSOR_BINARY_REPORT', report => {
            if (!report || !report.hasOwnProperty('Sensor Value') || !report.hasOwnProperty('Sensor Type')) return null;

            if (report['Sensor Type'] === 'Tamper' && report['Sensor Value'] === 'detected an event') {
                this.setCapabilityValue('alarm_tamper', true);
                
                if (this.tamperTimeOut) clearTimeout(this.tamperTimeOut);
                this.tamperTimeOut = setTimeout(() => {
                    this.setCapabilityValue('alarm_tamper', false);
                }, TAMPER_TIMEOUT);
            }
        });

        this.registerCapability('measure_luminance', 'SENSOR_MULTILEVEL');
        this.registerCapability('measure_temperature', 'SENSOR_MULTILEVEL');
        this.registerCapability('measure_battery', 'BATTERY');

        this.registerSetting('basic_set_level', input => new Buffer([(input >= 100 && input < 255) ? 255 : input]));
        this.registerSetting('temperature_monitoring', input => {
            // Multi-Sensor Function Switch bit 6 (0x000000)
            let param6 = 4;	// Default value: Disable magentic integrate PIR

            if (input) { param6 += 64; }

            return new Buffer([param6]);
        });
    }

    async onSettings(oldSettings, newSettings, changedKeys, callback) {
		if (changedKeys.includes('test_mode') || changedKeys.includes('operation_mode') || changedKeys.includes('door/window_mode')) {
			let param5 = Number(newSettings.operation_mode) + 8;
			if (typeof newSettings.test_mode === 'boolean' && newSettings.test_mode) param5 += 2;
            if (typeof newSettings['door/window_mode'] === 'boolean' && newSettings['door/window_mode']) param5 += 4;

            try {
                await this.configurationSet({
                    index: 5,
                    size: 1,
                }, param5);

                callback(null, true);
            } catch (err) {
                callback(err, null);
            }
        }

        callback(null, true);
    }
}

module.exports = DevoloMotionSensor;
