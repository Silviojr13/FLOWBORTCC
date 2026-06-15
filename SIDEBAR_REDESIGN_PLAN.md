# SIDEBAR REDESIGN PLAN — FLOWBOT

## 1. Arquivos Encontrados

### Sidebar & Navegação
| Arquivo | Função |
|---|---|
| `components/app-sidebar.tsx` | Sidebar principal — monta header, content (NavMain, NavDocuments, NavSecondary) e footer (NavUser) |
| `components/nav-main.tsx` | Navegação principal — "Quick Create", Inbox, Dashboard, Lifecycle, Analytics, Projects, Team |
| `components/nav-documents.tsx` | Seção "Documents" — Data Library, Reports, Word Assistant com dropdown de ações |
| `components/nav-secondary.tsx` | Navegação secundária — Settings, Get Help, Search |
| `components/nav-user.tsx` | Área do usuário — Avatar, nome, email, dropdown (Account, Billing, Notifications, Log out) |
| `components/ui/sidebar.tsx` | Componente base Shadcn — toda a infraestrutura de sidebar (provider, context, slots, variants) |

### Layout & Tema
| Arquivo | Função |
|---|---|
| `app/layout.tsx` | Layout raiz — importa fontes **Geist** e **Geist_Mono**, aplica `TooltipProvider` |
| `app/globals.css` | Tema global — variáveis CSS (cores, sidebar, deep space palette), animações, scrollbar |
| `app/page.tsx` | Página principal — monta `SidebarProvider > AppSidebar > SidebarInset > SiteHeader > ChatPage` |
| `app/dashboard/page.tsx` | Dashboard — mesma estrutura da página principal (duplicado) |
| `components/site-header.tsx` | Topbar — `SidebarTrigger`, separador, título "FLOWBOT" |

### Componentes de Conteúdo
| Arquivo | Função |
|---|---|
| `components/chatbot.tsx` | Chat principal — conversas, streaming, message bubbles |
| `components/chat-input.tsx` | Input do chat — textarea, botões de ação, send/stop |
| `components/welcome-screen.tsx` | Tela de boas-vindas — sugestões de projeto |
| `components/ui/button.tsx` | Componente botão Shadcn — variants (default, outline, secondary, ghost, destructive, link) |

---

## 2. Componentes Envolvidos

### Diretamente modificados
- **`app-sidebar.tsx`** — Reescrita completa da estrutura (remover nav atual, adicionar logo, CTA, botões auth)
- **`nav-user.tsx`** — Mantido, possíveis ajustes visuais mínimos
- **`app/layout.tsx`** — Troca de fonte Geist → Roboto
- **`app/globals.css`** — Ajuste de `--font-sans`, possível ajuste de cor da sidebar para azul marinho

### Removidos do fluxo visual (não deletados)
- **`nav-main.tsx`** — Removido do `AppSidebar` (import mantido ou removido)
- **`nav-documents.tsx`** — Removido do `AppSidebar`
- **`nav-secondary.tsx`** — Removido do `AppSidebar`

### Mantidos sem alteração
- `components/ui/sidebar.tsx` — Base Shadcn, nenhuma mudança necessária
- `components/ui/button.tsx` — Botões Shadcn, suficiente para os novos botões
- `components/site-header.tsx` — Topbar permanece
- `components/chatbot.tsx` — Chat não é afetado
- `components/chat-input.tsx` — Input não é afetado
- `components/welcome-screen.tsx` — Welcome não é afetado

---

## 3. O que será REMOVIDO (do fluxo visual da sidebar)

- Todos os itens de `navMain`: Dashboard, Lifecycle, Analytics, Projects, Team
- Todos os itens de `navClouds`: Capture, Proposal, Prompts
- Todos os itens de `navSecondary`: Settings, Get Help, Search
- Todos os itens de `documents`: Data Library, Reports, Word Assistant
- O botão "Quick Create" e o botão "Inbox"
- O header atual com `CommandIcon` + "Acme Inc."
- Ícones Lucide associados: `LayoutDashboardIcon`, `ListIcon`, `ChartBarIcon`, `FolderIcon`, `UsersIcon`, `CameraIcon`, `FileTextIcon`, `Settings2Icon`, `CircleHelpIcon`, `SearchIcon`, `DatabaseIcon`, `FileChartColumnIcon`, `FileIcon`, `CommandIcon`

**Nota:** Os arquivos `nav-main.tsx`, `nav-documents.tsx`, `nav-secondary.tsx` **não serão deletados**, apenas removidos do fluxo de renderização do `AppSidebar`.

---

## 4. O que será MANTIDO

- `NavUser` — Área do usuário com avatar, nome, email e dropdown (Account, Billing, Notifications, Log out)
- `SidebarProvider` / `Sidebar` / `SidebarInset` — Toda a infraestrutura Shadcn
- `SidebarHeader` / `SidebarContent` / `SidebarFooter` — Slots estruturais
- `SiteHeader` — Topbar com trigger e título
- Tema escuro e todas as variáveis CSS atuais
- `collapsible="offcanvas"` — comportamento de colapso

---

## 5. O que será CRIADO / ADICIONADO

### Na sidebar (`app-sidebar.tsx`)
1. **Logo** — `next/image` com `public/flowbot-logo.svg`, max-width 180px, alinhada à esquerda, `priority`
2. **Botão "Criar Projeto"** — CTA principal, 46px altura, `bg-primary`, `PlusIcon`, largura total, `rounded-xl`, sombra glow no hover
3. **Botão "Registrar"** — Largura total, 44px, `bg-primary`, `rounded-xl`
4. **Botão "Login"** — Largura total, 44px, `variant="outline"`, `rounded-xl`, border sutil
5. **Estrutura flexbox** — `flex flex-col` com `flex-1` spacer no `SidebarContent` para empurrar auth + user ao rodapé
6. **Separador** — Linha sutil (`h-px bg-white/6`) entre botões auth e NavUser

### Fonte global
1. **Roboto** (400, 500, 700) via `next/font/google` no `layout.tsx`
2. **Roboto_Mono** (400, 500) substituindo `Geist_Mono`
3. CSS variables: `--font-roboto-sans`, `--font-roboto-mono`
4. Metadata atualizado: title="FlowBot"

---

## 6. Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Geist_Mono é usada em code blocks no chat | Font render pode mudar levemente | Usar Roboto Mono como substituto ou manter Geist_Mono apenas para `--font-mono` |
| `nav-main.tsx`, `nav-documents.tsx`, `nav-secondary.tsx` ficam órfãos | Código morto | Manter arquivos para uso futuro, apenas remover imports |
| Sidebar width pode não comportar botões de largura total | Botões podem ficar apertados | Ajustar `--sidebar-width` se necessário (atualmente `calc(var(--spacing) * 72)` ≈ 288px) |
| Geist é usada via `--font-geist-sans` em outros locais | Fontes inconsistentes | Verificar e substituir todas as referências |
| Dashboard page (`app/dashboard/page.tsx`) usa a mesma sidebar | Mudança afeta ambas | Ambas usam `AppSidebar`, mudança é automática |

---

## 7. Dependências

- **`next/font/google`** — Para carregar Roboto (já disponível no Next.js 16)
- **`lucide-react`** — Para `PlusIcon` no botão "Criar Projeto" (já instalado)
- **`@/components/ui/button`** — Para os novos botões (já disponível)
- **`@/components/ui/sidebar`** — Slots estruturais (já disponível)
- Nenhuma nova dependência necessária

---

## 8. Etapas de Implementação

### Etapa 1 — Fonte Global (Roboto)
**Arquivos:** `app/layout.tsx`, `app/globals.css`
- Substituir `Geist` por `Roboto` (weights 400, 500, 700)
- Remover `Geist_Mono` ou substituir por `Roboto_Mono`
- Atualizar `--font-sans: var(--font-roboto-sans)` no CSS
- Atualizar `--font-mono` para usar a nova fonte mono

### Etapa 2 — Estrutura da Sidebar
**Arquivo:** `components/app-sidebar.tsx`
- Remover imports de `NavMain`, `NavDocuments`, `NavSecondary`
- Remover o `data` object completo (navMain, navClouds, navSecondary, documents, user)
- Manter user data local para o `NavUser`
- Limpar imports de ícones Lucide não utilizados
- Reestruturar com flexbox: Header (logo) → Content (CTA + flex spacer) → Footer (auth + user)

### Etapa 3 — Logo Placeholder
**Arquivo:** `components/app-sidebar.tsx`
- Criar área no `SidebarHeader` com:
  - Container horizontal, padding adequado
  - Texto "FLOWBOT" como placeholder (font-semibold, ~text-lg)
  - Largura reservada: 140–180px
  - Alinhado à esquerda

### Etapa 4 — Botão Principal (Criar Projeto)
**Arquivo:** `components/app-sidebar.tsx`
- Adicionar no topo do `SidebarContent`:
  - Botão com `PlusIcon` + "Criar Projeto"
  - `bg-primary text-primary-foreground`
  - Largura quase total (`w-full` com padding lateral)
  - `rounded-lg`, hover suave (`hover:bg-primary/90`)
  - Tamanho maior que botões normais (h-10 ou h-11)

### Etapa 5 — Botões de Auth (Registrar + Login)
**Arquivo:** `components/app-sidebar.tsx`
- Adicionar acima do `NavUser` no `SidebarFooter`:
  - Botão "Registrar" — sólido, azul vibrante, largura total
  - Botão "Login" — estilo outline/ghost, largura total
  - Espaçamento adequado entre eles (`gap-2`)

### Etapa 6 — Área do Usuário
**Arquivo:** `components/nav-user.tsx`
- Verificar que a área do usuário funciona corretamente
- Ajustes visuais mínimos se necessário (espaçamento, padding)
- Garantir compatibilidade com a nova estrutura

### Etapa 7 — Refinamentos Visuais
**Arquivos:** `components/app-sidebar.tsx`, `app/globals.css`
- Ajustar cor de fundo da sidebar para azul marinho (se necessário ajustar `--sidebar`)
- Verificar responsividade (desktop, notebook, tablet, mobile)
- Ajustar paddings, gaps, margens
- Testar colapso da sidebar
- Garantir que o topbar continua funcional

### Etapa 8 — Validação Final
- Verificar que nenhuma referência quebrada existe
- Testar build (`next build`)
- Validar visual em diferentes viewports
- Confirmar que chat, input e welcome screen não foram afetados
