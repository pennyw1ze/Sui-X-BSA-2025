# NLP_sanity_Checker.py
import re
import json
from langdetect import detect, DetectorFactory
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
import jieba  # Chinese
import fugashi  # Japanese
from konlpy.tag import Okt  # Korean

DetectorFactory.seed = 0  # Make langdetect deterministic

# Load stopwords
try:
    with open("stopwords.json", "r", encoding="utf-8") as f:
        STOPWORDS = json.load(f)
except FileNotFoundError:
    print("Warning: stopwords.json not found. Stopword ratio checks will be skipped.")
    STOPWORDS = {
        "en": ["the","and","is","in","it","to","of","a","that","for","on","with","as","was","are","at","by","this","from","or"],
        "es": ["de","la","que","el","en","y","a","los","se","del","las","por","un","para","con","no","una","su","al","lo"],
        "fr": ["de","la","et","le","à","les","des","en","du","un","que","pour","dans","par","est","sur","qui","se","au"],
        "de": ["und","der","die","das","in","zu","den","von","mit","nicht","ist","des","dem","ein","eine","als","auch","auf"],
        "zh": ["的","了","在","是","我","有","和","就","不","人","都","一","一个","上","也","很","到","他","她"],
        "ar": ["في","من","على","و","إلى","عن","أن","مع","كان","ما","لا","هذا","هذه","الذي","ذلك","كل","كما","هو"],
        "ru": ["и","в","не","на","что","он","с","как","а","его","по","но","за","из","к","она","они","ее"],
        "hi": ["और","के","है","से","में","का","कि","यह","को","पर","वह","की","जो","कर","हुआ","वे","इस"],
        "pt": ["de","que","e","o","da","em","um","para","com","não","uma","os","no","se","na","por","mais","as","dos"],
        "it": ["di","e","che","in","a","per","è","con","non","una","il","un","ma","le","si","dei","della","più","come"]
    }
# Tokenizers
okt = Okt()
jp_tokenizer = fugashi.Tagger()

def tokenize_text(text, lang):
    """Tokenize text depending on language family"""
    if lang.startswith("zh"):  # Chinese
        return list(jieba.cut(text))
    elif lang.startswith("ja"):  # Japanese
        return [word.surface for word in jp_tokenizer(text)]
    elif lang.startswith("ko"):  # Korean
        return okt.morphs(text)
    else:  # Default: simple word split
        return word_tokenize(text)

def compute_stats(text, lang):
    tokens = tokenize_text(text, lang)
    words = [t for t in tokens if t.isalpha()]

    num_words = len(words)
    avg_word_len = sum(len(w) for w in words) / num_words if num_words > 0 else 0
    alpha_ratio = sum(c.isalpha() for c in text) / max(len(text), 1)

    # Stopword ratio (if available)
    stopword_ratio = None
    if lang in STOPWORDS and num_words > 0:
        stop_count = sum(1 for w in words if w.lower() in STOPWORDS[lang])
        stopword_ratio = stop_count / num_words

    return {
        "language": lang,
        "words": num_words,
        "stopword_ratio": stopword_ratio,
        "avg_word_len": round(avg_word_len, 2),
        "alpha_ratio": round(alpha_ratio, 2),
    }

def is_garbage(text, stats):
    """Heuristics to flag garbage text"""

    # 1. Empty / too short
    if len(text.strip()) < 5:
        return True

    # 2. Short-text heuristic (relax stopword requirement)
    if stats["words"] < 3 and stats["alpha_ratio"] > 0.7:
        return False

    # 3. Stopword ratio (if available)
    if stats["stopword_ratio"] is not None:
        if stats["stopword_ratio"] < 0.05:
            return True

    # 4. Alpha ratio too low (too many symbols/numbers)
    if stats["alpha_ratio"] < 0.5:
        return True

    return False

def sanity_check(text):
    try:
        lang = detect(text)
    except:
        lang = None

    if not lang:
        return {"garbage": True, "stats": {"language": None}}

    stats = compute_stats(text, lang)
    garbage = is_garbage(text, stats)
    return {"garbage": garbage, "stats": stats}


if __name__ == "__main__":
    samples = [
        "This is a perfectly normal English sentence that should pass sanity check.",
        "asdkj qweuioq zxcmvnq qweiuo",
        "Esto es un documento válido en español.",
        "这是一个有效的中文句子。",
        "これは有効な日本語の文です。",
        "이것은 유효한 한국어 문장입니다.",
        "123 456 $$$ ####",
    ]

    for txt in samples:
        result = sanity_check(txt)
        print(f"\nText: {txt[:40]} ...")
        print("Garbage?:", result["garbage"])
        print("Stats:", result["stats"])
