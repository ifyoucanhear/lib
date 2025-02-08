#!/bin/bash

# permite a execução desse script por meio de outro diretório
cd "$(dirname "$0")"

# a última versão de unicodedata.txt pode ser encontrada em:
# https://unicode.org/Public/UNIDATA/UnicodeData.txt
#
# estático, cópias versionadas possuem urls similar como:
# https://www.unicode.org/Public/6.1.0/ucd/UnicodeData.txt
curl -# http://www.unicode.org/Public/6.1.0/ucd/UnicodeData.txt > UnicodeData-6.1.0.txt

# gerar as expressões regulares
python parse.py UnicodeData-6.1.0.txt > output.txt

# mini hack para remover o último comma
sed -i '' -e 's/,$//' output.txt

# mostrar o resultado
cat output.txt