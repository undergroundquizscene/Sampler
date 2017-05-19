(function() {
    document.addEventListener('DOMContentLoaded', init, false);

    function init() {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioContext();

        const filenames = {
            'kick': 'http://lizardpeoplelizardchurch.netsoc.co/Sampler/Samples/kick_int.wav',
			'snare': 'http://lizardpeoplelizardchurch.netsoc.co/Sampler/Samples/snare_left.wav',
			'closed-hat': 'http://lizardpeoplelizardchurch.netsoc.co/Sampler/Samples/hat_close.wav',
			'high-tom': 'http://lizardpeoplelizardchurch.netsoc.co/Sampler/Samples/tom2.wav',
			'crash': 'http://lizardpeoplelizardchurch.netsoc.co/Sampler/Samples/crash_high.wav',
			'open-hat': 'http://lizardpeoplelizardchurch.netsoc.co/Sampler/Samples/hat_open.wav',
			'mid-tom': 'http://lizardpeoplelizardchurch.netsoc.co/Sampler/Samples/tom3.wav',
			'low-tom': 'http://lizardpeoplelizardchurch.netsoc.co/Sampler/Samples/tom4.wav',
			'pedal-hat': 'http://lizardpeoplelizardchurch.netsoc.co/Sampler/Samples/hat_foot.wav',
        };
        const muteGroups = {
            'hihat': ['closed-hat', 'open-hat', 'pedal-hat'],
        };
        Sampler.init(audioContext, filenames, muteGroups);
        let pads = document.querySelectorAll('.padGrid-pad');
        let kickPad = pads[0];
        let snarePad = pads[1];
        Sampler.pads['snare'].setTarget(kickPad);
        Sampler.pads['kick'].setTarget(snarePad);
    }

    var Sampler = {
        init: function(context, filenames, muteGroups) {
            this.output = context.createGain();
            this.output.connect(audioContext.destination);
            this.pads = {};
            this.screenPads = document.querySelectorAll('.padGrid-pad');
            let i = 0;
            for (let name in filenames) {
                let pad = Object.create(SamplePad);
                pad.setup(context, name, filenames[name]);
                pad.connect(this.output);
                pad.setTarget(this.screenPads[i]);
                this.screenPads[i].samplerPad = pad;
                this.pads[name] = pad;
                i++;
            }
            this.muteGroups = {};
            for (let groupName in muteGroups) {
                this.createMuteGroup(groupName, muteGroups[groupName]);
            }
            var masterSlider = Object.create(GainSlider);
            masterSlider.connect(document.querySelector('#master'), this.output.gain);
        },
        createMuteGroup: function(name, padNames) {
            let pads = {};
            for (let padName of padNames) {
                pads[padName] = this.pads[padName];
            }
            let muteGroup = Object.create(MuteGroup);
            muteGroup.create(pads, name);
            if (name in this.muteGroups) {
                this.muteGroups[name].destroy();
            }
            this.muteGroups[name] = muteGroup;
        },
        deleteMuteGroup: function(name) {
            this.muteGroups[name].destroy();
            delete this.muteGroups[name];
        },
        disableMuteGroup: function(name) {
            this.muteGroups[name].disable();
        },
        enableMuteGroup: function(name) {
            this.muteGroups[name].enable();
        },
        playSamples: function(clickEvent) {
            for (let pad of Object.values(clickEvent.target.samplerPads)) {
                pad.playSample();
            }
        },
    };

    var SamplePad = {
        setup: function(audioContext, name, filename) {
            this.context = audioContext;
            this.name = name;
            this.muteGroups = {};
            this.createSignalPath();
            this.loadSample(filename);
        },
        createSignalPath: function() {
            this.muteGain = this.context.createGain();
            this.gain = this.context.createGain();
            this.send = this.context.createGain();

            this.muteGain.connect(this.gain);
            this.gain.connect(this.send);
        },
        loadSample: function(filename) {
            var receiveAudio = function(request) {
                if (request.readyState === 4 && request.status === 200) {
                    const audioData = request.response;
                    var successFunction = function(buffer) {this.buffer = buffer;};
                    var errorFunction = function(e){"Error decoding audio file." + e.err;};

                    request.removeEventListener('readystatechange', receiveAudio, false);
                    this.context.decodeAudioData(audioData, successFunction.bind(this), errorFunction);
                }
            };

            const request = new XMLHttpRequest();
            request.open('GET', filename, true);
            request.responseType = 'arraybuffer';
            request.addEventListener('readystatechange', receiveAudio.bind(this, request), false);
            request.send();
        },
        playSample: function() {
            if (this.buffer) {
                const source = this.context.createBufferSource();
                source.buffer = this.buffer;
                source.connect(this.muteGain);
                this.unMute();
                this.triggerMuteGroups();
                source.start();
            }
        },
        mute: function() {
            this.muteGain.gain.value = 0;
        },
        unMute: function() {
            this.muteGain.gain.value = 1;
        },
        connect: function(destination) {
            this.gain.connect(destination);
        },
        connectSend: function(destination) {
            this.send.connect(destination);
        },
        addMuteGroup: function(group) {
            this.muteGroups[group.name] = group;
        },
        removeMuteGroup: function(group) {
            delete this.muteGroups[group.name];
        },
        triggerMuteGroups: function() {
            for (let groupName in this.muteGroups) {
                this.muteGroups[groupName].trigger(this);
            }
        },
        addTarget: function(target) {
            if ('target' in this) {
                this.targets[target.name] = target;
            } else {
                this.targets = {}
                this.targets[target.name] = target;
                for (let target of Object.values(this.targets)) {
                    target.addEventListener('click', Sampler.playSample, false);
                }
            }
            if (!('samplerPads' in target)) {
                target.samplerPads = {};
            }
            target.samplerPads[this.name] = this;
        },
        removeTarget: function(target) {
            delete this.targets[target.name];
            if (Object.keys(this.target).length === 0) {
                this.targets.removeEventListener('click', Sampler.playSample, false);
            }
        },
        setTarget: function(target) {
            if ('target' in this) {
                delete this.target.samplerPads[this.name];
                if (Object.keys(this.target.samplerPads).length === 0) {
                    this.target.removeEventListener('click', Sampler.playSample, false);
                    delete this.target.samplerPads;
                }
            }
            this.target = target;
            if (!('samplerPads' in this.target)) {
                this.target.samplerPads = {};
                this.target.addEventListener('click', Sampler.playSamples, false);
            }
            this.target.samplerPads[this.name] = this;
        },
    };

    var MuteGroup = {
        create: function(pads, name) {
            this.pads = pads;
            this.name = name;
            for (let padName in pads) {
                pads[padName].addMuteGroup(this);
            }
            this.active = true;
        },
        destroy: function() {
            for (let name in this.pads) {
                this.pads[name].removeMuteGroup(this);
            }
            this.active = false;
        },
        disable: function() {
            this.active = false;
        },
        enable: function() {
            this.active = true;
        },
        trigger: function(playing) {
            if (this.active) {
                for (let name in this.pads) {
                    if (this.pads[name] !== playing) {
                        this.pads[name].mute();
                    }
                }
            }
        },
    };

    var GainSlider = {
        input: null,
        connect: function(input, target) {
            this.setTarget(target);
            this.setInput(input);
        },
        setTarget: function(gain) {
            this.target = gain;
        },
        setInput: function(input) {
            if (this.input) {
                this.input.removeEventListener('input', this.handleInput.bind(this), false);
            }
            this.input = input;
            this.input.addEventListener('input', this.handleInput.bind(this), false);
        },
        handleInput: function(inputEvent) {
            if (inputEvent.target.value > 1) {
                this.target.value = 1;
            } else if (inputEvent.target.value < -1) {
                this.target.value = -1;
            } else {
                this.target.value = inputEvent.target.value;
            }
        },
    };
}());
