import { EmptyState } from './EmptyState'

/** Erro de carga de dados: mostra a mensagem real e deixa tentar de novo (em vez de parecer lista vazia). */
export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="page">
      <div className="load-error" role="alert">
        <EmptyState
          title="Não deu para carregar seus dados"
          action={
            <button type="button" className="btn btn--lume" onClick={onRetry}>
              Tentar de novo
            </button>
          }
        >
          {message}
        </EmptyState>
      </div>
    </div>
  )
}
