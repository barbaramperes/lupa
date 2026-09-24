/**
 * Build estático, para alojamento sem servidor.
 *
 * O motor de `packages/core` é código puro: o mesmo `analisar()` que a API
 * executa corre no browser sem alteração nenhuma. A única diferença é de onde
 * vem o núcleo — de um pedido à API, ou de um ficheiro servido ao lado da app.
 *
 * Isto não substitui a API: é um segundo alvo de build do mesmo código, para
 * a aplicação poder ser demonstrada num URL sem infraestrutura por trás.
 */
export const environment = { estatico: true, nucleoUrl: 'nucleo/core.json' };
