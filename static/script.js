const update_shown = (id, attr_name) => {
    el = document.getElementById(id)
    for (const child of el.parentElement.querySelectorAll(`[${attr_name}]`)) {
        if (child.getAttribute(attr_name).includes(el.value)) {
            child.removeAttribute('hidden')
        } else {
            child.setAttribute('hidden', 'true')
        }
    }
}

const extract_config = () => {
    return {
        num_words:                  (el = document.getElementById('num-words')).hidden              ? undefined : parseInt(el.value),
        word_length_min:            (el = document.getElementById('min-word-length')).hidden        ? undefined : parseInt(el.value),
        word_length_max:            (el = document.getElementById('max-word-length')).hidden        ? undefined : parseInt(el.value),
        case_transform:             (el = document.getElementById('case-transformation')).hidden    ? undefined : el.value,
        separator_character:        (el = document.getElementById('sep-type')).hidden               ? undefined : (el.value === 'specified' ? document.getElementById('sep-char').value : el.value),
        separator_alphabet:               document.getElementById('sep-alphabet').hidden            ? undefined : Array.from(document.getElementsByClassName('sep-alphabet-item')).map(el => el.value),
        padding_digits_before:      (el = document.getElementById('digits-before')).hidden          ? undefined : parseInt(el.value),
        padding_digits_after:       (el = document.getElementById('digits-after')).hidden           ? undefined : parseInt(el.value),
        padding_type:               (el = document.getElementById('pad-type')).hidden               ? undefined : el.value,
        pad_to_length:              (el = document.getElementById('pad-to-length')).hidden          ? undefined : parseInt(el.value),
        padding_character:          (el = document.getElementById('pad-char-type')).hidden          ? undefined : (el.value === 'specified' ? document.getElementById('pad-char').value : el.value),
        symbol_alphabet:                  document.getElementById('pad-alphabet').hidden            ? undefined : Array.from(document.getElementsByClassName('pad-alphabet-item')).map(el => el.value),
        padding_characters_before:  (el = document.getElementById('symbols-before')).hidden         ? undefined : parseInt(el.value),
        padding_characters_after:   (el = document.getElementById('symbols-after')).hidden          ? undefined : parseInt(el.value),
        random_increment: 'AUTO',   //  ¯\_(ツ)_/¯
    }
}

const save_config = () => {
    document.getElementById('config-textarea').value = JSON.stringify(extract_config(), null, 2)
}

const load_config = () => {
    err_el = document.getElementById('error')

    try {
        config = JSON.parse(document.getElementById('config-textarea').value)
    } catch (err) {
        err_el.textContent = err
        return
    }

    const values = select_el => Array.from(select_el.options).map(option_el => option_el.value)

    for (const [field, id] of [
        ['num_words', 'num-words'],
        ['word_length_min', 'min-word-length'],
        ['word_length_max', 'max-word-length'],
        ['case_transform', 'case-transformation'],
        // separator_character
        // separator_alphabet
        ['padding_digits_before', 'digits-before'],
        ['padding_digits_after', 'digits-after'],
        ['padding_type', 'pad-type'],
        ['pad_to_length', 'pad-to-length'],
        // padding_character
        // symbol_alphabet
        ['padding_characters_before', 'symbols-before'],
        ['padding_characters_after', 'symbols-after'],
    ]) {
        if (config[field] === undefined) {
            continue
        }

        config[field] = config[field].toString()

        el = document.getElementById(id)
        if (!values(el).includes(config[field])) {
            err_el.textContent = `"${config[field]}" is not a valid value for "${field}"`
            return
        }

        el.value = config[field]
    }

    if (!config.separator_character) {
        err_el.textContent = '"separator_character" must be supplied (try "NONE")'
        return
    }
    sep_type_el = document.getElementById('sep-type')
    if (values(sep_type_el).includes(config.separator_character)) {
        sep_type_el.value = config.separator_character
    } else {
        sep_type_el.value = 'specified'
        document.getElementById('sep-char').value = config.separator_character
    }


    if (config.separator_character === 'RANDOM') {
        if (!config.separator_alphabet) {
            err_el.textContent = '"separator_character" is "RANDOM" so "separator_alphabet" must be supplied'
            return
        }

        sep_alphabet_el = document.getElementById('sep-alphabet')
        while (sep_alphabet_el.firstChild) {
            sep_alphabet_el.firstChild.remove()
        }

        for (const ch of config.separator_alphabet) {
            input_el = document.createElement('input')
            input_el.setAttribute('type', 'text')
            input_el.setAttribute('size', 1)
            input_el.setAttribute('maxlength', 1)
            input_el.classList.add('sep-alphabet-item')
            input_el.value = ch
            sep_alphabet_el.appendChild(input_el)
        }
    }

    if (config.padding_type !== 'NONE') {
        if (!config.padding_character) {
            err_el.textContent = '"padding_character" must be supplied (try "padding_type": "NONE")'
            return
        }
        pad_char_type_el = document.getElementById('pad-char-type')
        if (values(pad_char_type_el).includes(config.padding_character)) {
            pad_char_type_el.value = config.padding_character
        } else {
            sep_type_el.value = 'specified'
            document.getElementById('pad-char').value = config.padding_character
        }
    }

    if (config.padding_character === 'RANDOM') {
        if (!config.symbol_alphabet) {
            err_el.textContent = '"padding_character" is "RANDOM" so "symbol_alphabet" must be supplied'
            return
        }

        pad_alphabet_el = document.getElementById('pad-alphabet')
        while (pad_alphabet_el.firstChild) {
            pad_alphabet_el.firstChild.remove()
        }

        for (const ch of config.symbol_alphabet) {
            input_el = document.createElement('input')
            input_el.setAttribute('type', 'text')
            input_el.setAttribute('size', 1)
            input_el.setAttribute('maxlength', 1)
            input_el.classList.add('pad-alphabet-item')
            input_el.value = ch
            pad_alphabet_el.appendChild(input_el)
        }
    }

    update_all()
    err_el.textContent = null
}

const generate_passwords = async () => {
    save_config()

    n_passwords = parseInt(document.getElementById('num-passwords').value)
    resp = await fetch('/api', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            n: parseInt(document.getElementById('num-passwords').value),
            config: extract_config(),
        }),
    })
    document.getElementById('generated-passwords-textarea').value = await resp.text()
}

const update_all = () => {
    document.getElementById('sep-type').dispatchEvent(new Event('change'))
    document.getElementById('pad-type').dispatchEvent(new Event('change'))
    document.getElementById('pad-char-type').dispatchEvent(new Event('change'))
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('sep-type').addEventListener('change', () => update_shown('sep-type', 'data-shown-for'))
    document.getElementById('pad-type').addEventListener('change', () => update_shown('pad-type', 'data-shown-for'))
    document.getElementById('pad-char-type').addEventListener('change', () => update_shown('pad-char-type', 'data-shown-for-sub'))

    update_all()
})
