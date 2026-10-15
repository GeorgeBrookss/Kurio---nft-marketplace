import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

export function NotFoundView({ title = 'Página não encontrada', description = 'O endereço acessado não existe.' }: { title?: string; description?: string }) {
  return (
    <section className="container mt-24 max-w-lg text-center" aria-labelledby="nf-title">
      <p className="text-5xl font-bold text-primary" aria-hidden="true">404</p>
      <h1 id="nf-title" className="mt-4 text-xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      <Button asChild className="mt-6"><Link to="/">Voltar ao início</Link></Button>
    </section>
  )
}
