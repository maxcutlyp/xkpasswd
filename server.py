import flask

import typing as t
import secrets
import json

import enum
from dataclasses import dataclass, field
from dataclasses_json import dataclass_json

class CaseTransform(enum.Enum):
    NONE = 'NONE'
    ALTERNATE = 'ALTERNATE'
    CAPITALISE = 'CAPITALISE'
    INVERT = 'INVERT'
    LOWER = 'LOWER'
    UPPER = 'UPPER'
    RANDOM = 'RANDOM'

word_transform_fn: dict[CaseTransform, t.Callable[[list[str]], list[str]]] = {
    CaseTransform.NONE:         lambda words: words,
    CaseTransform.ALTERNATE:    lambda words: [word.lower() if i%2 == 0 else word.upper() for i,word in enumerate(words)],
    CaseTransform.CAPITALISE:   lambda words: [word[0].upper() + word[1:].lower() for word in words],
    CaseTransform.INVERT:       lambda words: [word[0].lower() + word[1:].upper() for word in words],
    CaseTransform.LOWER:        lambda words: [word.lower() for word in words],
    CaseTransform.UPPER:        lambda words: [word.upper() for word in words],
    CaseTransform.RANDOM:       lambda words: [secrets.choice([word.upper(), word.lower()]) for word in words],
}

class SeparatorCharacter(enum.Enum):
    NONE = 'NONE'
    RANDOM = 'RANDOM'

class PaddingType(enum.Enum):
    NONE = 'NONE'
    FIXED = 'FIXED'
    ADAPTIVE = 'ADAPTIVE'

class PaddingCharacter(enum.Enum):
    SEPARATOR = 'SEPARATOR'
    RANDOM = 'RANDOM'

@dataclass_json
@dataclass
class Config:
    num_words: int = 3
    word_length_min: int = 4
    word_length_max: int = 8
    case_transform: CaseTransform = CaseTransform.ALTERNATE
    separator_character: SeparatorCharacter | str = SeparatorCharacter.RANDOM
    separator_alphabet: list[str] = field(default_factory=lambda:['!', '@', '$', '%', '^', '&', '*', '-', '_', '+', '=', ':', '|', '~', '?', '/', '.', ';'])
    padding_digits_before: int = 2
    padding_digits_after: int = 2
    padding_type: PaddingType = PaddingType.FIXED
    pad_to_length: int = 32
    padding_character: PaddingCharacter | str = PaddingCharacter.RANDOM
    symbol_alphabet: list[str] = field(default_factory=lambda:['!', '@', '$', '%', '^', '&', '*', '-', '_', '+', '=', ':', '|', '~', '?', '/', '.', ';'])
    padding_characters_before: int = 2
    padding_characters_after: int = 2
    random_increment: str = 'AUTO' # this is not mentioned anywhere in the orignial perl library but it was present when you clicked "save_config" on the website

app = flask.Flask(__name__)

# you will probably need to change this depending on your configuration
from werkzeug.middleware.proxy_fix import ProxyFix
app.wsgi_app = ProxyFix(app.wsgi_app, x_host=1, x_for=1)

@app.route('/', methods=['GET'])
def index():
    return flask.render_template('index.html', default_seps = Config().separator_alphabet, domain = flask.request.url_root.rstrip('/'))

@app.route('/api', methods=['POST'])
def api():
    if flask.request.is_json:
        req_json = flask.request.json
    else:
        req_json = {}

    try: n = req_json['n']
    except KeyError: n = 3
    try: config_dict = req_json['config']
    except KeyError: config_dict = {}

    print(config_dict)
    config = Config.from_dict(config_dict)
    return '\n'.join(generate_passwords(n, config))

@app.route('/embed', methods=['GET'])
def embed():
    try:
        req_json = json.loads(flask.request.args['r'])
        n = req_json['n']
        config_dict = req_json['config']
    except (KeyError, json.JSONDecodeError):
        n = 3
        config_dict = {}

    print(config_dict)
    config = Config.from_dict(config_dict)
    return flask.render_template('embed.html', pws_str='\n'.join(generate_passwords(n, config)))

def generate_passwords(
    n: int,
    config: Config,
) -> list[str]:
    return [generate_password(config) for _ in range(n)]

def generate_password(config: Config):
    words = list(filter(lambda word : config.word_length_min <= len(word) <= config.word_length_max, wordlist))
    words = [secrets.choice(words) for _ in range(config.num_words)]
    words = word_transform_fn[config.case_transform](words)

    digits_before = ''.join([str(secrets.randbelow(10)) for _ in range(config.padding_digits_before)])
    digits_after = ''.join([str(secrets.randbelow(10)) for _ in range(config.padding_digits_after)])

    try:
        config.separator_character = SeparatorCharacter(config.separator_character)
    except ValueError:
        separator = lambda : config.separator_character
    else:
        if config.separator_character == SeparatorCharacter.NONE:
            separator = lambda : ''
        elif config.separator_character == SeparatorCharacter.RANDOM:
            separator = lambda : secrets.choice(config.separator_alphabet)

    try:
        config.padding_character = PaddingCharacter(config.padding_character)
    except ValueError:
        padding_character = lambda : config.padding_character
    else:
        if config.padding_character == PaddingCharacter.SEPARATOR:
            padding_character = separator
        elif config.padding_character == PaddingCharacter.RANDOM:
            padding_character = lambda : secrets.choice(config.symbol_alphabet)

    if config.padding_type == PaddingType.NONE:
        padding_before = padding_after = ''
    elif config.padding_type == PaddingType.FIXED:
        padding_before = ''.join([padding_character() for _ in range(config.padding_characters_before)])
        padding_after = ''.join([padding_character() for _ in range(config.padding_characters_after)])
    elif config.padding_type == PaddingType.ADAPTIVE:
        padding_before = ''
        padding_after = lambda length : ''.join([padding_character() for _ in range(config.pad_to_length - length)])

    password = ''
    password += padding_before
    password += digits_before

    words_and_seps = []
    for word in words:
        words_and_seps.append(separator())
        words_and_seps.append(word)
    if not digits_before:
        words_and_seps.pop(0)
    password += ''.join(words_and_seps)

    if digits_after:
        password += separator()
    password += digits_after

    if isinstance(padding_after, str):
        password += padding_after
    else:
        password += padding_after(len(password))

    return password

class BadPayload(Exception):
    def __init__(self, message):
        super().__init__(self, message)
        self.message = message

    def response(self):
        return flask.Response(self.message, 400)

if __name__ == '__main__':
    with open('wordlist.txt', 'r') as wl_file:
        wordlist = [line[:-1] for line in wl_file.readlines()]
        print(wordlist[-1])

    app.run(port=9001)
