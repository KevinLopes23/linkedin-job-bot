/** HTML mínimo no formato das páginas públicas do LinkedIn (usado nos testes). */

export interface CardFixture {
  id: string
  title: string
  company: string
  location: string
  extra?: string
  liExtra?: string
}

export const card = (c: CardFixture): string => `
<li>${c.liExtra ?? ''}
  <div class="base-card base-search-card job-search-card" data-entity-urn="urn:li:jobPosting:${c.id}">
    <a class="base-card__full-link" href="https://br.linkedin.com/jobs/view/vaga-${c.id}?refId=abc&trackingId=x"></a>
    <div class="base-search-card__info">
      <h3 class="base-search-card__title">${c.title}</h3>
      <h4 class="base-search-card__subtitle"><a>${c.company}</a></h4>
      <div class="base-search-card__metadata">
        <span class="job-search-card__location">${c.location}</span>
        ${c.extra ?? ''}
      </div>
    </div>
  </div>
</li>`

export const searchPage = (cards: readonly CardFixture[]): string =>
  `<html><body><ul class="jobs-search__results-list">${cards.map(card).join('')}</ul></body></html>`

export const detailPage = (opts: { body?: string; description?: string; similar?: string; htmlExtra?: string }): string => `
<html><body>
  <section class="top-card-layout"><h1>Vaga</h1>
    ${opts.body ?? ''}</section>
  <div class="decorated-job-posting__details">
    <section class="core-section-container description">
      <div class="description__text"><div class="show-more-less-html__markup">${opts.description ?? '<p>Vaga para trabalhar com React e Node.js.</p>'}</div></div>
      <ul class="description__job-criteria-list"><li>Tempo integral</li></ul>
    </section>
  </div>
  <section class="core-section-container similar-jobs"><h2>Vagas semelhantes</h2><ul><li>${opts.similar ?? ''}</li></ul></section>
  ${opts.htmlExtra ?? ''}
</body></html>`

/** Busca legítima sem resultado (o LinkedIn mostra o aviso, sem cards). */
export const noResultsSearchPage =
  '<html><body><h1>Não encontramos resultados para Vagas de Desenvolvedor em: Bauru, São Paulo, Brasil</h1></body></html>'

/** Página que o LinkedIn devolve quando pede login (authwall): sem lista, sem vaga, com o formulário de cadastro. */
export const authwallPage =
  '<html><head><title>Cadastre-se | LinkedIn</title></head><body><h1 class="authwall-join-form__title">Cadastre-se no LinkedIn</h1>' +
  '<form class="join-form"><input name="email-or-phone" /></form></body></html>'
