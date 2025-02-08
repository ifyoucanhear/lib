# xregexp

fornece expressões regulares JavaScript aumentadas e extensíveis. você obtém novas sintaxes, sinalizadores e métodos além dos que os navegadores suportam nativamente. xregexp também é um cinto de utilitários de expressão regular com ferramentas para simplificar o grepping do lado do cliente e, ao mesmo tempo, evitar inconsistências entre navegadores.

## exemplos de uso

```javascript
<script src="xregexp.js"></script>
<script>
    var date = XRegExp('(?<year>  [0-9]{4}) -?  # ano  \n\
                        (?<month> [0-9]{2}) -?  # mês \n\
                        (?<day>   [0-9]{2})     # dia   ', 'x');
    
    var match = date.exec('2012-02-22');
    console.log(match.day);
    console.log('2012-02-22'.replace(date, '${month}/${day}/${year}'));
    
    console.log(XRegExp.matchChain('1 <b>2</b> 3 <b>4 a 56</b>',
                                   [/<b>.*?<\/b>/i, /\d+/]));
</script>
```
