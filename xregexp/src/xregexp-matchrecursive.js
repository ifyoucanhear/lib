// xregexp match recursive plugin v0.1.1

var XRegExp;

if (!XRegExp) {
    throw ReferenceError("xregexp precisa ser carregado antes do plugin match recursive");
}

XRegExp.matchRecursive = function (str, left, right, flags, options) {
    var options      = options || {},
        escapeChar   = options.escapeChar,
        vN           = options.valueNames,

        flags        = flags || "",
        global       = flags.indexOf("g") > -1,
        ignoreCase   = flags.indexOf("i") > -1,
        multiline    = flags.indexOf("m") > -1,
        sticky       = flags.indexOf("y") > -1,
        flags        = flags.replace(/y/g, ""),

        left         = left  instanceof RegExp ? (left.global  ? left  : XRegExp.copyAsGlobal(left))  : XRegExp(left,  "g" + flags),
        right        = right instanceof RegExp ? (right.global ? right : XRegExp.copyAsGlobal(right)) : XRegExp(right, "g" + flags),
        
        output       = [],

        openTokens   = 0,
        delimStart   = 0,
        delimEnd     = 0,
        lastOuterEnd = 0,

        outerStart, innerStart, leftMatch, rightMatch, escaped, esc;

    if (escapeChar) {
        if (escapeChar.length > 1)
            throw SyntaxError("não é possível suportar mais de um caractere escape");

        if (multiline)
            throw TypeError("não é possível fornecer caracteres de escape ao usar o sinalizador multilinha");

        escaped = XRegExp.escape(escapeChar);

        // modificadores de padrão de escape:
        //
        // g - não necessário aqui
        // i - incluso
        // m - **não suportado**, retorna um erro
        // s - manipulado por xregexp quando delimitadores são fornecidos como strings
        // x - manipulado por xregexp quando delimitadores são fornecidos como strings
        // y - não necessário aqui; suportado por outro handling nessa função

        esc = RegExp(
            "^(?:" + escaped + "[\\S\\s]|(?:(?!" + left.source + "|" + right.source + ")[^" + escaped + "])+)+",
            ignoreCase ? "i" : ""
        );
    }
    
    while (true) {
        left.lastIndex = right.lastIndex = delimEnd + (escapeChar ? (esc.exec(str.slice(delimEnd)) || [""])[0].length : 0);

        leftMatch  = left.exec(str);
        rightMatch = right.exec(str);

        // apenas manter o resultado que bateu com a string anterior
        if (leftMatch && rightMatch) {
            if (leftMatch.index <= rightMatch.index)
                rightMatch = null;
            else leftMatch = null;
        }

        // paths*:
        //
        // leftmatch | rightmatch | opentokens | resultado
        // 1         | 0          | 1          | ...
        // 1         | 0          | 0          | ...
        // 0         | 1          | 1          | ...
        // 0         | 1          | 0          | throw
        // 0         | 0          | 1          | throw
        // 0         | 0          | 0          | break
        //
        // * - não inclui o modo sticky em caso especial
        
        if (leftMatch || rightMatch) {
            delimStart = (leftMatch || rightMatch).index;
            delimEnd   = (leftMatch ? left : right).lastIndex;
        } else if (!openTokens) {
            break;
        }

        if (sticky && !openTokens && delimStart > lastOuterEnd)
            break;

        if (leftMatch) {
            if (!openTokens++) {
                outerStart = delimStart;
                innerStart = delimEnd;
            }
        } else if (rightMatch && openTokens) {
            if (!--openTokens) {
                if (vN) {
                    if (vN[0] && outerStart > lastOuterEnd) output.push([vN[0], str.slice(lastOuterEnd, outerStart), lastOuterEnd, outerStart]);
                    if (vN[1]) output.push([vN[1], str.slice(outerStart,   innerStart), outerStart,   innerStart]);
                    if (vN[2]) output.push([vN[2], str.slice(innerStart,   delimStart), innerStart,   delimStart]);
                    if (vN[3]) output.push([vN[3], str.slice(delimStart,   delimEnd),   delimStart,   delimEnd]);
                } else {
                    output.push(str.slice(innerStart, delimStart));
                }

                lastOuterEnd = delimEnd;

                if (!global)
                    break;
            }
        } else {
            // resetar lastindex em caso de delimitadores fornecidos como regexes
            left.lastIndex = right.lastIndex = 0;

            throw Error("dado subjeto contém delimitadores desbalanceados");
        }

        // se o delimitador bate com uma string vazia
        if (delimStart === delimEnd)
            delimEnd++;
    }

    if (global && !sticky && vN && vN[0] && str.length > lastOuterEnd)
        output.push([vN[0], str.slice(lastOuterEnd), lastOuterEnd, str.length]);

    // resetar lastindex em caso de delimitadores fornecidos como regexes
    left.lastIndex = right.lastIndex = 0;

    return output;
};