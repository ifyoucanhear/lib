// xregexp v1.5.1

var XRegExp;

if (XRegExp) {
    // isolar de rodar duas vezes, quebrando referências para globais nativas
    throw Error("não é possível carregar o xregexp duas vezes no mesmo frame");
}

// executa dentro de uma função anônima para proteger variáveis ​​e evitar novos globais
(function (undefined) {
    // ----------
    // construtor
    // ----------

    // aceita um padrão e sinalizadores; retorna um novo objeto `regexp` estendido. difere
    // de uma expressão regular nativa porque há suporte para sintaxe e sinalizadores
    // adicionais e as inconsistências de sintaxe entre navegadores são melhoradas
    XRegExp = function (pattern, flags) {
        var output = [],
            currScope = XRegExp.OUTSIDE_CLASS,
            pos = 0,
            context,
            tokenResult,
            match,
            chr,
            regex;

        if (XRegExp.isRegExp(pattern)) {
            if (flags !== undefined)
                throw TypeError("não é possível fornecer sinalizadores ao construir um regexp de outro");

            return clone(pattern);
        }

        // os tokens tornam-se parte do processo de construção de regex, portanto, proteja-se contra
        // recursão infinita quando um xregexp for construído em um manipulador de token ou gatilho
        if (isInsideConstructor)
            throw Error("não é possível chamar o construtor xregexp nas funções de definição de token");

        flags = flags || "";

        context = {
            hasNamedCapture: false,
            captureNames: [],

            hasFlag: function (flag) { return flags.indexOf(flag) > -1; },
            setFlag: function (flag) { flags += flag; }
        };

        while (pos < pattern.length) {
            // checa por tokens customizados na posição atual
            tokenResult = runTokens(pattern, pos, currScope, context);

            if (tokenResult) {
                output.push(tokenResult.output);

                pos += (tokenResult.match[0].length || 1);
            } else {
                // checa por metasequências de multi-caractere nativo
                if (match = nativ.exec.call(nativeTokens[currScope], pattern.slice(pos))) {
                    output.push(match[0]);

                    pos += match[0].length;
                } else {
                    chr = pattern.charAt(pos);

                    if (chr === "[")
                        currScope = XRegExp.INSIDE_CLASS;
                    else if (chr === "]")
                        currScope = XRegExp.OUTSIDE_CLASS;

                    // posição avançada de um caractere
                    output.push(chr);

                    pos++;
                }
            }
        }

        regex = RegExp(output.join(""), nativ.replace.call(flags, flagClip, ""));

        regex._xregexp = {
            source: pattern,
            captureNames: context.hasNamedCapture ? context.captureNames : null
        };
        
        return regex;
    };

    // ---------------------
    // propriedades públicas
    // ---------------------

    XRegExp.version = "1.5.1";

    // bitflags de scope de token
    XRegExp.INSIDE_CLASS = 1;
    XRegExp.OUTSIDE_CLASS = 2;

    // ------------------
    // variáveis privadas
    // ------------------

    var replacementToken = /\$(?:(\d\d?|[$&`'])|{([$\w]+)})/g,
        flagClip = /[^gimy]+|([\s\S])(?=[\s\S]*\1)/g,
        quantifier = /^(?:[?*+]|{\d+(?:,\d*)?})\??/,

        isInsideConstructor = false,

        tokens = [],

        nativ = {
            exec: RegExp.prototype.exec,
            test: RegExp.prototype.test,
            match: String.prototype.match,
            replace: String.prototype.replace,
            split: String.prototype.split
        },

        compliantExecNpcg = nativ.exec.call(/()??/, "")[1] === undefined, // verifica o tratamento `exec` de grupos de captura não participantes
        
        compliantLastIndexIncrement = function () {
            var x = /^/g;

            nativ.test.call(x, "");

            return !x.lastIndex;
        }(),

        hasNativeY = RegExp.prototype.sticky !== undefined,
        nativeTokens = {};

    // `nativetokens` batem apenas com as meta-sequências de multi-caractere nativas
    nativeTokens[XRegExp.INSIDE_CLASS]  = /^(?:\\(?:[0-3][0-7]{0,2}|[4-7][0-7]?|x[\dA-Fa-f]{2}|u[\dA-Fa-f]{4}|c[A-Za-z]|[\s\S]))/;
    nativeTokens[XRegExp.OUTSIDE_CLASS] = /^(?:\\(?:0(?:[0-3][0-7]{0,2}|[4-7][0-7]?)?|[1-9]\d*|x[\dA-Fa-f]{2}|u[\dA-Fa-f]{4}|c[A-Za-z]|[\s\S])|\(\?[:=!]|[?*+]\?|{\d+(?:,\d*)?}\??)/;

    // ----------------
    // métodos públicos
    // ----------------

    // permite estender ou alterar a sintaxe xregexp e criar sinalizadores personalizados. isso
    // é usado internamente pela biblioteca xregexp e pode ser usado para criar plugins xregexp
    //
    // função destinada a usuários com conhecimento avançado da sintaxe e do comportamento de
    // expressões regulares do javascript. pode ser desativada por `xregexp.freezetokens`
    XRegExp.addToken = function(regex, handler, scope, trigger) {
        tokens.push({
            pattern: clone(regex, "g" + (hasNativeY ? "y" : "")),
            handle: handler,
            scope: scope || XRegExp.OUTSIDE_CLASS,
            trigger: trigger || null
        });
    };

    // aceita um padrão e sinalizadores; retorna um objeto `regexp` estendido. se a
    // combinação de padrão e sinalizador tiver sido armazenada em cache
    // anteriormente, a cópia em cache será retornada; caso contrário, o regex
    // recém-criado será armazenado em cache
    XRegExp.cache = function(pattern, flags) {
        var key = pattern + "/" + (flags || "");

        return XRegExp.cache[key] || (XRegExp.cache[key] = XRegExp(pattern, flags));
    };

    // aceita uma instância `regexp`; retorna uma cópia com o sinalizador `/g` definido
    // a cópia tem um novo `lastindex` (definido como zero). se você deseja copiar uma
    // regex sem forçar a propriedade `global`, use `xregexp(regex)`. não usar `regexp(regex)`
    // porque não preservará as propriedades especiais necessárias para captura nomeada
    XRegExp.copyAsGlobal = function(regex) {
        return clone(regex, "g");
    };

    // aceita uma string; retorna a string com as meta-caracteres regex. a string
    // retornada pode ser usada com segurança em qualquer ponto de uma regex para
    // corresponder à string literal fornecida. os caracteres de escape são [ ]
    // { } ( ) * + ? - . , \^$ | # e espaço em branco
    XRegExp.escape = function(str) {
        return str.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
    };

    // aceita uma string para pesquisar, regex para pesquisar, posição para iniciar
    // a pesquisa dentro da string (padrão: 0) e um booleano opcional indicando se
    // as correspondências devem começar na posição ou após a posição ou apenas na
    // posição especificada. essa função ignora o `lastindex` do regex fornecido em
    // seu próprio tratamento, mas atualiza a propriedade para compatibilidade
    XRegExp.execAt = function(str, regex, pos, anchored) {
        var r2 = clone(regex, "g" + ((anchored && hasNativeY) ? "y" : "")), match;

        r2.lastIndex = pos = pos || 0;

        match = r2.exec(str); // executa o `exec` alterado (necessário para correção de `lastindex`, etc)

        if (anchored && match && match.index !== pos)
            match = null;

        if (regex.global)
            regex.lastIndex = match ? r2.lastIndex : 0;

        return match;
    };

    // quebra o link não restaurável para a lista privada de tokens do xregexp,
    // evitando assim alterações de sintaxe e de sinalizador. deve ser executado
    // após o xregexp e todos os plugins serem carregados
    XRegExp.freezeTokens = function() {
        XRegExp.addToken = function() {
            throw Error("não é possível executar addtoken após freezetokens");
        };
    };

    // aceita qualquer valor; retorna um booleano indicando se o argumento é um
    // objeto `regexp`. Observe que isso também é `true` para literais regex e
    // regexes criados pelo construtor `xregexp`
    XRegExp.isRegExp = function(o) {
        return Object.prototype.toString.call(o) === "[object RegExp]";
    };

    // executa `callback` uma vez por correspondência em `str`. fornece uma
    // maneira mais simples e limpa de iterar correspondências de regex em
    // comparação com as abordagens tradicionais de subverter
    // `string.prototype.replace` ou chamar repetidamente `exec` dentro de
    // um loop `while`
    XRegExp.iterate = function (str, regex, callback, context) {
        var r2 = clone(regex, "g"), i = -1, match;

        while (match = r2.exec(str)) { // executa o `exec` alterado (necessário para correção de `lastindex`, etc)
            if (regex.global)
                regex.lastIndex = r2.lastIndex; // fazendo isso para seguir as expectativas se `lastindex` for verificado em `callback`

            callback.call(context, match, ++i, str, regex);

            if (r2.lastIndex === match.index)
                r2.lastIndex++;
        }

        if (regex.global)
            regex.lastIndex = 0;
    };

    // aceita uma string e um array de regexes; retorna o resultado do uso
    // de cada regex sucessiva para pesquisar nas correspondências da regex
    // anterior. a matriz de regexes também pode conter objetos com
    // propriedades `regex` e `backref`, caso em que as referências
    // anteriores nomeadas ou numeradas especificadas são passadas para a
    // próxima regex ou retornadas. exemplo:
    //
    // var xregexpImgFileNames = XRegExp.matchChain(html, [
    //     {regex: /<img\b([^>]+)>/i, backref: 1},
    //     {regex: XRegExp('(?ix) \\s src=" (?<src> [^"]+ )'), backref: "src"},
    //     {regex: XRegExp("^http://xregexp\\.com(/[^#?]+)", "i"), backref: 1},
    //     /[^\/]+$/
    // ]);
    XRegExp.matchChain = function(str, chain) {
        return function recurseChain(values, level) {
            var item = chain[level].regex ? chain[level] : {regex: chain[level]}, regex = clone(item.regex, "g"), matches = [], i;

            for (i = 0; i < values.length; i++) {
                XRegExp.iterate(values[i], regex, function(match) {
                    matches.push(item.backref ? (match[item.backref] || "") : match[0]);
                });
            }

            return ((level === chain.length - 1) || !matches.length) ? matches : recurseChain(matches, level + 1);
        }([str], 0);
    };

    // ---------------------------------
    // novos métodos de protótipo regexp
    // ---------------------------------

    // aceita um objeto de contexto e uma matriz de argumentos; retorna o
    // resultado da chamada de `exec` com o primeiro valor na matriz de
    // argumentos. o contexto é ignorado, mas é aceito por congruência
    // com `function.prototype.apply`
    RegExp.prototype.apply = function(context, args) {
        return this.exec(args[0]);
    };

    // aceita um objeto de contexto e uma string; retorna o resultado da chamada
    // de `exec` com a string fornecida. o contexto é ignorado, mas é aceito por
    // congruência com `function.prototype.call`
    RegExp.prototype.call = function (context, str) {
        return this.exec(str);
    };

    // ----------------------------
    // métodos nativos substituídos
    // ----------------------------

    // adiciona suporte de captura nomeados (com referências retornadas como `result.name`)
    RegExp.prototype.exec = function(str) {
        var match, name, r2, origLastIndex;

        if (!this.global)
            origLastIndex = this.lastIndex;

        match = nativ.exec.apply(this, arguments);

        if (match) {
            // corrige navegadores cujos métodos `exec` não retornam consistentemente
            // `indefinido` para grupos de captura não participantes
            if (!compliantExecNpcg && match.length > 1 && indexOf(match, "") > -1) {
                r2 = RegExp(this.source, nativ.replace.call(getNativeFlags(this), "g", ""));

                // usando `str.slice(match.index)` em vez de `match[0]` caso o lookahead
                // permitisse a correspondência devido a caracteres fora da correspondência
                nativ.replace.call((str + "").slice(match.index), r2, function () {
                    for (var i = 1; i < arguments.length - 2; i++) {
                        if (arguments[i] === undefined)
                            match[i] = undefined;
                    }
                });
            }

            // anexa propriedades de captura nomeadas
            if (this._xregexp && this._xregexp.captureNames) {
                for (var i = 1; i < match.length; i++) {
                    name = this._xregexp.captureNames[i - 1];

                    if (name)
                       match[name] = match[i];
                }
            }

            // corrija navegadores que incrementam `lastindex` após correspondências de comprimento zero
            if (!compliantLastIndexIncrement && this.global && !match[0].length && (this.lastIndex > match.index))
                this.lastIndex--;
        }

        if (!this.global)
            this.lastIndex = origLastIndex; // corrige bug do ie, opera (último teste ie 9.0.5, opera 11.61 no windows)

        return match;
    };

    // corrige bugs do navegador no método nativo
    RegExp.prototype.test = function(str) {
        // usa o `exec` nativo para pular alguma sobrecarga de processamento, mesmo que
        // o `exec` alterado cuide das correções do `lastindex`
        var match, origLastIndex;

        if (!this.global)
            origLastIndex = this.lastIndex;

        match = nativ.exec.call(this, str);

        // corrige navegadores que incrementam `lastindex` após correspondências de comprimento zero
        if (match && !compliantLastIndexIncrement && this.global && !match[0].length && (this.lastIndex > match.index))
            this.lastIndex--;

        if (!this.global)
            this.lastIndex = origLastIndex; // corrige o bug do ie, opera (último teste ie 9.0.5, opera 11.61 no windows)

        return !!match;
    };

    // adiciona suporte de captura nomeada e corrige bugs do navegador no método nativo
    String.prototype.match = function(regex) {
        if (!XRegExp.isRegExp(regex))
            regex = RegExp(regex); // `regexp` nativo

        if (regex.global) {
            var result = nativ.match.apply(this, arguments);

            regex.lastIndex = 0; // corrige o bug do ie

            return result;
        }

        return regex.exec(this); // executa o `exec` alterado
    };

    // adiciona suporte para tokens `${n}`
    String.prototype.replace = function(search, replacement) {
        var isRegex = XRegExp.isRegExp(search), captureNames, result, str, origLastIndex;

        if (isRegex) {
            if (search._xregexp)
                captureNames = search._xregexp.captureNames; // array ou `null`
            if (!search.global)
                origLastIndex = search.lastIndex;
        } else {
            search = search + ""; // conversão de tipo
        }

        if (Object.prototype.toString.call(replacement) === "[object Function]") {
            result = nativ.replace.call(this + "", search, function () {
                if (captureNames) {
                    // altera a string primativa `arguments[0]` para um objeto string que pode armazenar propriedades
                    arguments[0] = new String(arguments[0]);

                    // armazena referências anteriores nomeadas em `arguments[0]`
                    for (var i = 0; i < captureNames.length; i++) {
                        if (captureNames[i])
                            arguments[0][captureNames[i]] = arguments[i + 1];
                    }
                }

                // atualiza o `lastindex` antes de chamar `replacement` (corrigir navegadores)
                if (isRegex && search.global)
                    search.lastIndex = arguments[arguments.length - 2] + arguments[0].length;

                return replacement.apply(null, arguments);
            });
        } else {
            // conversão de tipo, então `args[args.length - 1]` será uma string (considerando `this` sem string)
            str = this + "";

            result = nativ.replace.call(str, search, function () {
                // mantém os `argumentos` desta função disponíveis através do encerramento
                var args = arguments;

                return nativ.replace.call(replacement + "", replacementToken, function ($0, $1, $2) {
                    // referência anterior numerada (sem delimitadores) ou variável especial
                    if ($1) {
                        switch ($1) {
                            case "$": return "$";
                            case "&": return args[0];
                            case "`": return args[args.length - 1].slice(0, args[args.length - 2]);
                            case "'": return args[args.length - 1].slice(args[args.length - 2] + args[0].length);
                            
                            // referência anterior numerada
                            default:
                                var literalNumbers = "";

                                $1 = +$1; // conversão de tipo; descartar zero à esquerda

                                if (!$1) // `$1` foi um "0" ou "00"
                                    return $0;

                                while ($1 > args.length - 3) {
                                    literalNumbers = String.prototype.slice.call($1, -1) + literalNumbers;

                                    $1 = Math.floor($1 / 10); // soltar o último dígito
                                }

                                return ($1 ? args[$1] || "" : "$") + literalNumbers;
                        }
                    // referência retroativa nomeada ou referência retroativa numerada delimitada
                    } else {
                        var n = +$2; // conversão de tipo; eliminar zeros à esquerda

                        if (n <= args.length - 3)
                            return args[n];

                        n = captureNames ? indexOf(captureNames, $2) : -1;

                        return n > -1 ? args[n + 1] : $0;
                    }
                });
            });
        }

        if (isRegex) {
            if (search.global)
                search.lastIndex = 0; // corrige bug do ie, safari (último teste ie v9.0.5, safari v5.1.2 no windows)
            else
                search.lastIndex = origLastIndex; // corrige bug do ie, opera (último teste ie v9.0.5, opera v11.61 no windows)
        }

        return result;
    };

    // um `split` compatível com vários navegadores e compatível com es3
    String.prototype.split = function (s /* separator */, limit) {
        // se o separador `s` não for um regex, usar o `split` nativo
        if (!XRegExp.isRegExp(s))
            return nativ.split.apply(this, arguments);

        var str = this + "", // conversão de tipo
            output = [],
            lastLastIndex = 0,
            match, lastLength;

        if (limit === undefined || +limit < 0) {
            limit = Infinity;
        } else {
            limit = Math.floor(+limit);

            if (!limit)
                return [];
        }

        // isso é necessário se não for `s.global` e evita a necessidade de definir `s.lastindex` como
        // zero e restaurá-lo ao seu valor original quando terminarmos de usar o regex
        s = XRegExp.copyAsGlobal(s);

        while (match = s.exec(str)) { // executar o `exec` alterado (necessário para correção de `lastindex`, etc)
            if (s.lastIndex > lastLastIndex) {
                output.push(str.slice(lastLastIndex, match.index));

                if (match.length > 1 && match.index < str.length)
                    Array.prototype.push.apply(output, match.slice(1));

                lastLength = match[0].length;
                lastLastIndex = s.lastIndex;

                if (output.length >= limit)
                    break;
            }

            if (s.lastIndex === match.index)
                s.lastIndex++;
        }

        if (lastLastIndex === str.length) {
            if (!nativ.test.call(s, "") || lastLength)
                output.push("");
        } else {
            output.push(str.slice(lastLastIndex));
        }

        return output.length > limit ? output.slice(0, limit) : output;
    };

    // ---------------------------
    // funções auxiliares privadas
    // ---------------------------

    // função de suporte para `xregexp`, `xregexp.copyasglobal`, etc. retorna uma cópia de uma instância `regexp`
    // com um novo `lastindex` (definido como zero), preservando as propriedades
    // 
    // também permite adicionar novas flags no processo de cópia da regex
    function clone(regex, additionalFlags) {
        if (!XRegExp.isRegExp(regex))
            throw TypeError("tipo regexp esperado");

        var x = regex._xregexp;

        regex = XRegExp(regex.source, getNativeFlags(regex) + (additionalFlags || ""));

        if (x) {
            regex._xregexp = {
                source: x.source,
                captureNames: x.captureNames ? x.captureNames.slice(0) : null
            };
        }
        
        return regex;
    }

    function getNativeFlags(regex) {
        return (regex.global     ? "g" : "") +
               (regex.ignoreCase ? "i" : "") +
               (regex.multiline  ? "m" : "") +
               (regex.extended   ? "x" : "") + // proposto para es4; incluído em as3
               (regex.sticky     ? "y" : "");
    }

    function runTokens(pattern, index, scope, context) {
        var i = tokens.length, result, match, t;

        // protege contra a construção de xregexps no manipulador de token e funções de gatilho
        isInsideConstructor = true;

        // redefinir `isinsideconstructor`, mesmo se um `trigger` ou `handler` for lançado
        try {
            while (i--) { // executar na ordem inversa
                t = tokens[i];

                if ((scope & t.scope) && (!t.trigger || t.trigger.call(context))) {
                    t.pattern.lastIndex = index;

                    // executar o `exec` alterado aqui permite o uso de referências anteriores nomeadas, etc
                    match = t.pattern.exec(pattern);
                    
                    if (match && match.index === index) {
                        result = {
                            output: t.handler.call(context, match, scope),
                            match: match
                        };

                        break;
                    }
                }
            }
        } catch (err) {
            throw err;
        } finally {
            isInsideConstructor = false;
        }

        return result;
    }

    function indexOf (array, item, from) {
        if (Array.prototype.indexOf) // usar o método de array nativo, se disponível
            return array.indexOf(item, from);

        for (var i = from || 0; i < array.length; i++) {
            if (array[i] === item)
                return i;
        }

        return -1;
    }

    // ------------------
    // tokens construídos
    // ------------------

    // padrão de comentário: (?# )
    XRegExp.addToken(
        /\(\?#[^)]*\)/,

        function (match) {
            // mantém os tokens separados, a menos que o token a seguir seja um quantificador
            return nativ.test.call(quantifier, match.input.slice(match.index + match[0].length)) ? "" : "(?:)";
        }
    );

    // grupo captor (corresponde apenas ao parêntese de abertura).
    // necessário para suporte de grupos de captura nomeados
    XRegExp.addToken(
        /\((?!\?)/,

        function () {
            this.captureNames.push(null);

            return "(";
        }
    );

    // grupo captor nomeado (corresponde apenas ao delimitador de abertura): (?<name>
    XRegExp.addToken(
        /\(\?<([$\w]+)>/,

        function (match) {
            this.captureNames.push(match[1]);
            this.hasNamedCapture = true;

            return "(";
        }
    );

    // referência retroativa nomeada: \k<name>
    XRegExp.addToken(
        /\\k<([\w$]+)>/,

        function (match) {
            var index = indexOf(this.captureNames, match[1]);

            // manter referências anteriores separadas dos números literais subsequentes
            return index > -1 ? "\\" + (index + 1) + (isNaN(match.input.charAt(match.index + match[0].length)) ? "" : "(?:)") : match[0];
        }
    );

    // classe de caractere vazia: [] ou [^]
    XRegExp.addToken(
        /\[\^?]/,

        function (match) {
            // para compatibilidade entre navegadores com es3, converta [] para \b\b e [^] para [\s\s].
            // (?!) deveria funcionar como \b\b, mas não é confiável no firefox
            return match[0] === "[]" ? "\\b\\B" : "[\\s\\S]";
        }
    );

    // modificador de modo apenas no início do padrão, com qualquer combinação de sinalizadores imsx: (?imsx)
    // não suporta x(?i), (?-i), (?i-m), (?i: ), (?i)(?m), etc
    XRegExp.addToken(
        /^\(\?([imsx]+)\)/,

        function (match) {
            this.setFlag(match[1]);

            return "";
        }
    );

    // espaços em branco e comentários, apenas no modo de espaçamento livre (estendido)
    XRegExp.addToken(
        /(?:\s+|#.*)+/,

        function(match) {
            // mantém os tokens separados, a menos que o token a seguir seja um quantificador
            return nativ.test.call(quantifier, match.input.slice(match.index + match[0].length)) ? "" : "(?:)";
        },

        XRegExp.OUTSIDE_CLASS,

        function() {
            return this.hasFlag("x");
        }
    );

    // ponto, apenas no modo dotall (linha única)
    XRegExp.addToken(
        /\./,

        function() {
            return "[\\s\\S]";
        },

        XRegExp.OUTSIDE_CLASS,

        function() {
            return this.hasFlag("s");
        }
    );

    // --------------------------------------
    // compatibilidade com versões anteriores
    // --------------------------------------

    // remover comentário do seguinte bloco para compatibilidade com xregexp v1.0-1.2:
    
    /**
     * XRegExp.matchWithinChain = XRegExp.matchChain;
     * RegExp.prototype.addFlags = function(s) { return clone(this, s); };
     * RegExp.prototype.execAll = function(s) { var r = []; XRegExp.iterate(s, this, function (m) {r.push(m);}); return r; };
     * RegExp.prototype.forEachExec = function(s, f, c) { return XRegExp.iterate(s, this, f, c); };
     * RegExp.prototype.validate = function(s) { var r = RegExp("^(?:" + this.source + ")$(?!\\s)", getNativeFlags(this)); if (this.global) this.lastIndex = 0; return s.search(r) === 0; };
     */
})();