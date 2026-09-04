/** Parser CSV RFC4180. Escrito à mão em vez de importado porque os ficheiros
 *  do CosIng têm campos com newlines embutidos (dezenas de linhas só no
 *  Anexo III) e vale a pena que o comportamento nesse caso esteja à vista
 *  e testado, em vez de ser uma caixa preta numa dependência. */
export function parseCsv(texto: string): string[][] {
  const linhas: string[][] = [];
  let campo = '';
  let linha: string[] = [];
  let dentroDeAspas = false;
  let i = 0;
  const s = texto.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  while (i < s.length) {
    const c = s[i]!;
    if (dentroDeAspas) {
      if (c === '"') {
        if (s[i + 1] === '"') { campo += '"'; i += 2; continue; }
        dentroDeAspas = false; i++; continue;
      }
      campo += c; i++; continue;
    }
    if (c === '"') { dentroDeAspas = true; i++; continue; }
    if (c === ',') { linha.push(campo); campo = ''; i++; continue; }
    if (c === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = ''; i++; continue; }
    campo += c; i++;
  }
  if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas;
}
