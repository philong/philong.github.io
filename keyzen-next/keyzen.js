var data = {};
var audio = {};
var hits_correct = 0;
var hits_wrong = 0;
var start_time = 0;
var hpm = 0;
var ratio = 0;

layouts={};
layouts["colemak"] = " tnseriaodhgjplfuwyq;vmc,x.z/bk4738291056'\"!?:@$%&#*()_ABCDEFGHIJKLMNOPQRSTUVWXYZ~+-={}|^<>`[]\\";
layouts["colemak-dh"] = " tnseriaogmplfuwyq;bjvhd,c.x/zk4738291056'\"!?:@$%&#*()_ABCDEFGHIJKLMNOPQRSTUVWXYZ~+-={}|^<>`[]\\";
layouts["colemak-dh-matrix"] = " tnseriaogmplfuwyq;bjdhc,x.z/vk4738291056'\"!?:@$%&#*()_ABCDEFGHIJKLMNOPQRSTUVWXYZ~+-={}|^<>`[]\\";
layouts["bépo"] = " tesirunamc,èvodpléjbk'.qxghyfàzw6758493021`-=[]\\;/ABCDEFGHIJKLMNOPQRSTUVWXYZ~!@#$%^&*()_+{}|:\"<>?";
layouts["qwerty"] = " fjdksla;ghrueiwoqptyvmc,x.z/bn4738291056`-=[]\\'ABCDEFGHIJKLMNOPQRSTUVWXYZ~!@#$%^&*()_+{}|:\"<>?";
layouts["azerty"] = " jfkdlsmqhgyturieozpabnvcxw6758493021`-=[]\\;',./ABCDEFGHIJKLMNOPQRSTUVWXYZ~!@#$%^&*()_+{}|:\"<>?";
layouts["custom"] = "etaonrishdlfcmugypwbvkjxzq";

// layouts["norman"] = " ntieosaygjkufrdlw;qbpvmcxz1234567890'\",.!?:;/@$%&#*()_ABCDEFGHIJKLMNOPQRSTUVWXYZ~+-={}|^<>`[]\\";
// layouts["code-es6"] = " {}',;():.>=</_-|`!?#[]\\+\"@$%&*~^";

const default_layout = 'colemak';
data.chars = layouts[default_layout];
data.consecutive = 5;
data.word_length = 7;
data.current_layout = default_layout;
data.custom_chars = '';

CUSTOM_LAYOUT = 'custom';

$(document).ready(function() {
    load_audio();
    if (localStorage.data != undefined) {
        load();
        if (data.current_layout == CUSTOM_LAYOUT && data.custom_chars) {
            data.chars = data.custom_chars;
        }
        render();
    }
    else {
        set_level(1);
    }
    $(document).keypress(keyHandler);
    $(document).keyup(keyupHandler);

    showActiveLayoutKeyboard();
});


function start_stats() {
    start_time = start_time || Math.floor(new Date().getTime() / 1000);
}

function update_stats() {
    if (start_time) {
        var current_time = (Math.floor(new Date().getTime() / 1000));
        ratio = Math.floor(
            hits_correct / (hits_correct + hits_wrong) * 100
        );
        hpm = Math.floor(
            (hits_correct + hits_wrong) / (current_time - start_time) * 60
        );
        if (!isFinite(hpm)) { hpm = 0; }
    }
}


function set_level(l) {
    data.in_a_row = {};
    for(var i = 0; i < data.chars.length; i++) {
        data.in_a_row[data.chars[i]] = data.consecutive;
    }
    data.in_a_row[data.chars[l]] = 0;
    data.level = l;
    data.word_index = 0;
    data.word_errors = {};
    data.word = generate_word();
    data.keys_hit = "";
    save();
    render();
}

function set_layout(l) {
    data.current_layout = l
	data.chars = layouts[l]
    data.in_a_row = {};
    for(var i = 0; i < data.chars.length; i++) {
        data.in_a_row[data.chars[i]] = data.consecutive;
    }
    data.word_index = 0;
    data.word_errors = {};
    data.word = generate_word();
    data.keys_hit = "";
    save();
    render();

    showActiveLayoutKeyboard();
}

function char_to_key(e) {
    let key = null;
    if (data.layout_mapping_enabled && layout_maps[get_current_layout()]) {
        const layout = get_current_layout();
        key = map_key(e, layout);
    }
    return key || String.fromCharCode(e.which);
}

function map_key(e, layout) {
    const map = layout_maps[layout] || {};
    const fallback_map = layout_maps['qwerty'] || {};
    const code = e.code;
    if (e.shiftKey) {
        return (map.shiftLayer || {})[code] || (fallback_map.shiftLayer || {})[code]
            || ((map[code] || fallback_map[code]) || '').toUpperCase();
    }
    return map[code] || fallback_map[code];
}

const keyPresses = {};

function keyupHandler(e) {
    keyPresses[e.code] = false;
}

function keyHandler(e) {
    if (keyPresses[e.code]) return;
    keyPresses[e.code] = true;

    start_stats();

    var key = char_to_key(e);
    if (data.chars.indexOf(key) < 0) {
        console.warn(`Key not found: ${key}`);
    }
    e.preventDefault();
    data.keys_hit += key;
    if(key == data.word[data.word_index]) {
        hits_correct += 1;
        data.in_a_row[key] += 1;
        play_audio_sample("correct");
    }
    else {
        hits_wrong += 1;
        data.in_a_row[data.word[data.word_index]] = 0;
        data.in_a_row[key] = 0;
        play_audio_sample("mistake");
        data.word_errors[data.word_index] = true;
    }
    data.word_index += 1;
    if (data.word_index >= data.word.length) {
        setTimeout(next_word, 400);
    }

    update_stats();

    render();
    save();
}

function next_word(){
	if(get_training_chars().length == 0) {
		level_up();
	}
	data.word = generate_word();
	data.word_index = 0;
	data.keys_hit = "";
	data.word_errors = {};
	update_stats();

    render();
    save();
}


function level_up() {
    if (data.level + 1 <= data.chars.length - 1) {
        play_audio_sample("level_up");
    }
    l = Math.min(data.level + 1, data.chars.length);
    set_level(l);
}


function save() {
    localStorage.data = JSON.stringify(data);
}


function load() {
    data = JSON.parse(localStorage.data);
}


function load_audio() {
    create_audio_context();
    audio.samples = {};
    load_audio_sample("correct", "click.mp3", 336);
    load_audio_sample("mistake", "clack.mp3", 304);
    load_audio_sample("level_up", "ding.wav", 1684);
}

let create_audio_context = function () {
    audio.context = new (window.AudioContext || window.webkitAudioContext)();
}

let load_audio_sample = function (name, url) {
    if (!audio.samples[name]) {
        // fetch the .wav file via XMLHttpRequest as jQuery doesn't support 'arraybuffer' dataType
        var request = new XMLHttpRequest();
        request.open("GET", url, true);
        request.responseType = "arraybuffer";
        request.onload = function () {
            audio.context.decodeAudioData(request.response).then(function (buffer) {
                audio.samples[name] = buffer;
            });
        };
        request.send();
    }
}

let play_audio_sample = function (name) {
    if (audio.samples[name]) {
        var source = audio.context.createBufferSource();
        source.buffer = audio.samples[name];
        source.onended
        source.connect(audio.context.destination);
        source.start();
    }
}

if (!location.hostname) {
    create_audio_context = function () {
        // Nothing
    }

    load_audio_sample = function (name, url, duration) {
        const sample = $(new Audio(url));
        sample.prop("playDuration", duration);
        audio.samples[name] = sample;
    }

    play_audio_sample = function (name) {
        const sample = audio.samples[name];
        if (!sample) return;
        const playDate = sample.prop("playDate");
        if (moment() - playDate <= sample.prop("playDuration") + 200) {
            (new Audio(sample.attr("src"))).play();
        } else {
            sample[0].play();
            sample.prop("playDate", moment());
        }
    }
}

function render() {
    render_layout();
    render_level();
    render_word();
    render_level_bar();
    render_map_layout();
    render_rigor();
    render_stats();
}

function render_layout() {
    var layouts_html = "<span id='layout'>";
    for(var layout in layouts){
        if(data.current_layout == layout){
            layouts_html += "<span style='color: #F78D1D' onclick='set_layout(\"" + layout + "\");'> "
        } else {
            layouts_html += "<span style='color: #AAA' onclick='set_layout(\"" + layout + "\");'> "
        }
        layouts_html += layout + "</span>";
    }
    layouts_html += "</span>";
    $("#layout").html('click to set layout: ' + layouts_html);
}

function render_level() {
    var chars = "<span id='level-chars-wrap'>";
    var level_chars = get_level_chars();
    var training_chars = get_training_chars();
    for (var c in data.chars) {
        if(training_chars.indexOf(data.chars[c]) != -1) {
            chars += "<span style='color: #F78D1D' onclick='set_level(" + c + ");'>"
        }
        else if (level_chars.indexOf(data.chars[c]) != -1) {
            chars += "<span style='color: #000' onclick='set_level(" + c + ");'>"
        }
        else {
            chars += "<span style='color: #AAA' onclick='set_level(" + c + ");'>"
        }
        if (data.chars[c] == ' ') {
            chars += "&#9141;";
        }
        else {
            chars += data.chars[c];
        }
        chars += "</span>";
    }
    chars += "</span>";
    $("#level-chars").html('click to set level: ' + chars);

    if (data.current_layout == CUSTOM_LAYOUT) {
        $('#level-chars').append('<a id="edit-custom-chars" href="#" data-toggle="modal" data-target="#custom-chars-modal"></a>');
        $('#level-chars #edit-custom-chars').append(' (<span style="color: #f78d1d">edit</span>)');

        $editCustomCharsLink = $('#edit-custom-chars');
        $editCustomCharsLink.click(function() {
            var $customCharsModal = $('#custom-chars-modal');
            var customChars = window.data.custom_chars || window.layouts[data.current_layout];
            $customCharsModal.find('textarea').val(customChars);

            $(document).off('keypress');
            $(document).off('keyup');
        });

        $customCharsModalOkButton = $('#custom-chars-modal--ok-button');
        $customCharsModalOkButton.click(function() {
            var $customCharsModal = $('#custom-chars-modal');
            var customCharsSubmitted = $customCharsModal.find('textarea').val();
            var customCharsProccessed = customCharsSubmitted;
            $customCharsModal.modal("hide");
            window.layouts[data.current_layout] = customCharsProccessed;
            window.data.chars = customCharsProccessed;
            window.data.custom_chars = customCharsProccessed;
            render_level();
            save();

            $(document).keypress(keyHandler);
            $(document).keyup(keyupHandler);
        });
    }
}

function render_rigor() {
    chars = "<span id='rigor-number' onclick='inc_rigor();'>";
    chars += '' + data.consecutive;
    chars += '</span>';
    $('#rigor').html('intensity: ' + chars);
}

function render_map_layout() {
    const layout = get_current_layout();
    if (!layout_maps[layout]) {
        $('#map-layout').html('');
        return;
    }

    let content = 'map layout: ';
    content += "<span id='map-layout-enabled' onclick='toggle_map_layout();'>";
    content += data.layout_mapping_enabled ? 'on&nbsp;' : 'off';
    content += '</span>';
    $('#map-layout').html(content);
}

function toggle_map_layout() {
    const layout = get_current_layout();
    if (!layout_maps[layout]) return;
    data.layout_mapping_enabled = !data.layout_mapping_enabled;
    render_map_layout();
}

function get_current_layout() {
    return data.current_layout !== 'custom' ? data.current_layout : 'colemak';
}

function render_stats() {
    $("#stats").text([
        "raw WPM: ", hpm / 5, " ",
        "accuracy: ", ratio, "%"
    ].join(""));
}

function inc_rigor() {
    data.consecutive += 1;
    if (data.consecutive > 9) {
        data.consecutive = 2;
    }
    render_rigor();
}


function render_level_bar() {
    training_chars = get_training_chars();
    if(training_chars.length == 0) {
        m = data.consecutive;
    }
    else {
        m = 1e100;
        for(c in training_chars) {
            m = Math.min(data.in_a_row[training_chars[c]], m);
        }
    }
    m = Math.floor($('#level-chars-wrap').innerWidth() * Math.min(1.0, m / data.consecutive));
    $('#next-level').css({'width': '' + m + 'px'});
    
}   

function render_word() {
    var word = "";
    for (var i = 0; i < data.word.length; i++) {
        sclass = "normalChar";
        if (i > data.word_index) {
            sclass = "normalChar";
        }
        else if (i == data.word_index) {
            sclass = "currentChar";
        }
        else if(data.word_errors[i]) {
            sclass = "errorChar";
        }
        else {
            sclass = "goodChar";
        }
        word += "<span class='" + sclass + "'>";
        if(data.word[i] == " ") {
            word += "&#9141;"
        }
        else if(data.word[i] == "&") {
            word += "&amp;"
        }
        else {
            word += data.word[i];
        }
        word += "</span>";
    }
    var keys_hit = "<span class='keys-hit'>";
    for(var d in data.keys_hit) {
        if (data.keys_hit[d] == ' ') {
            keys_hit += "&#9141;";
        }
        else if (data.keys_hit[d] == '&') {
            keys_hit += "&amp;";
        }
        else {
            keys_hit += data.keys_hit[d];
        }
    }
    for(var i = data.word_index; i < data.word_length; i++) {
        keys_hit += "&nbsp;";
    }
    keys_hit += "</span>";
    $("#word").html(word + "<br>" + keys_hit);
}


function generate_word_random() {
    let word = '';
    for(var i = 0; i < data.word_length; i++) {
        c = choose(get_training_chars());
        if(c != undefined && c != word[word.length-1]) {
            word += c;
        }
        else {
            word += choose(get_level_chars());
        }
    }
    return word;
}


function generate_word() {
    let word = '';

    for (var i = 0; i < data.word_length; i++) {
        let c;
        if (i == 0) {
            c = choose(get_training_chars())
        }
        else {
            // make a list of bigrams that could be used, start with the previous letter
            previous_letter = word[word.length - 1];
            possible_bigrams = bigrams_starting_with(previous_letter, get_training_chars());

            if (possible_bigrams.length > 0) {
                c = choose_non_uniform(possible_bigrams)[1];
            } else {
                c = choose(get_training_chars());
            }
        }
        if (c != undefined && c != word[word.length - 1]) {
            word += c;
        }
        else {
            const perms = permutations(get_level_chars());
            // filter perms to ones which start with previous letter
            keep = [];
            for (var j = 0; j < perms.length; j++) {
                if (perms[j][0] == word[word.length - 1] && perms[j][1] != ' ') {
                    keep.push(perms[j]);
                }
            }
            if (keep.length > 0) {
                c = choose_non_uniform(keep)[1];
            } else {
                c = choose(get_level_chars());
            }
            word += c;
        }
    }
    return word;
}

function strip_accents(str) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

function choose_non_uniform(values) {
    let sum = 0;
    for (var i = 0; i < values.length; i++) {
        sum += bigrams[strip_accents(values[i])] || 0;
    }
    normalisation_factor = 1 / sum;
    cumlative = 0;
    cutoff = Math.random()
    for (var i = 0; i < values.length; i++) {
        normalised = bigrams[values[i]] * normalisation_factor;
        cumlative += normalised;
        if (cumlative > cutoff) {
            return values[i];
        }
    }
    return values[i] || choose(values);

}

function permutations(iterable) {
    if (iterable.length < 2) { return false; }
    const perms = [];
    for (var i = 0; i < iterable.length; i++) {
        for (var j = 0; j < iterable.length; j++) {
            c = iterable[i] + iterable[j];
            d = iterable[j] + iterable[i];
            if (perms.indexOf(c) == -1) {
                perms.push(c);
            }
            if (perms.indexOf(d) == -1) {
                perms.push(d);
            }
        }
    }
    return perms;
}

function bigrams_starting_with(start_letter, iterable) {
    if (iterable.length < 2) { return false; }
    var bigrams = [];
    for (var i = 0; i < iterable.length; i++) {
        bigrams.push(start_letter + iterable[i]);
    }
    return bigrams;
}


function get_level_chars() {
    return data.chars.slice(0, data.level + 1).split('');
}

function get_training_chars() {
    var training_chars = [];
    var level_chars = get_level_chars();
    for(var x in level_chars) {
        if (data.in_a_row[level_chars[x]] < data.consecutive) {
            training_chars.push(level_chars[x]);
        }
    }
    return training_chars;
}

function choose(a) {
    return a[Math.floor(Math.random() * a.length)];
}

function showActiveLayoutKeyboard() {
    // Hide all, then show the active.
    $('.keyboard-layout').hide();
    var currentLayout = data.current_layout;
    // Custom chars have no default layout.
    if (currentLayout != CUSTOM_LAYOUT) {
        $('.keyboard-layout[data-layout="' + currentLayout + '"]').show()
    }
}
