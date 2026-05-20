import { memo, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

import { cn } from '@/lib/utils'

type MessageMarkdownProps = {
  content: string
  className?: string
  renderMath?: boolean
}

const remarkPlugins = [remarkGfm]
const remarkMathPlugins = [remarkGfm, remarkMath]
const rehypePlugins = [rehypeKatex]

function normalizeMathDelimiters(content: string) {
  return content
    .split(/(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`]*`)/g)
    .map(part => {
      if (
        part.startsWith('```') ||
        part.startsWith('~~~') ||
        part.startsWith('`')
      ) {
        return part
      }

      return part
        .replace(/\\\[([\s\S]*?)\\\]/g, (_, formula) =>
          normalizeMathBlock(formula)
        )
        .replace(
          /\\\(([\s\S]*?)\\\)/g,
          (_, formula) => '$' + formula.trim() + '$'
        )
        .replace(/\$\$([\s\S]*?)\$\$/g, (_, formula) =>
          normalizeMathBlock(formula)
        )
    })
    .join('')
}

function normalizeMathBlock(formula: string) {
  return '\n\n$$\n' + normalizeAlignedMath(formula.trim()) + '\n$$\n\n'
}

function normalizeAlignedMath(formula: string) {
  const needsAlignmentEnvironment = /(^|[^\\])&|\\\\/.test(formula)
  const hasMathEnvironment =
    /\\begin\{(?:aligned|alignedat|align|alignat|array|matrix|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|cases|gathered|split)\}/.test(
      formula
    )

  if (!needsAlignmentEnvironment || hasMathEnvironment) return formula

  return '\\begin{aligned}\n' + formula + '\n\\end{aligned}'
}

export const MessageMarkdown = memo(function MessageMarkdown({
  content,
  className,
  renderMath = true,
}: MessageMarkdownProps) {
  const markdownContent = useMemo(
    () => (renderMath ? normalizeMathDelimiters(content) : content),
    [content, renderMath]
  )

  return (
    <div
      className={cn(
        '[&_a]:text-primary [&_a]:no-underline hover:[&_a]:underline',
        '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.9em]',
        '[&_h1]:mt-6 [&_h1]:text-3xl [&_h1]:font-semibold',
        '[&_h2]:mt-6 [&_h2]:text-2xl [&_h2]:font-semibold',
        '[&_h3]:mt-5 [&_h3]:text-xl [&_h3]:font-medium',
        '[&_h4]:mt-4 [&_h4]:text-lg [&_h4]:font-medium',
        '[&_li]:my-1 [&_ol]:my-3 [&_p]:my-3 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ul]:my-3',
        '[&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-foreground/15 [&_pre]:bg-foreground/3 [&_pre]:px-3 [&_pre]:py-2 [&_pre]:shadow-inner/3',
        '[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:font-mono [&_pre_code]:text-[0.95em]',
        '[&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex-display]:py-2',
        className
      )}
    >
      <ReactMarkdown
        components={{
          table: ({ className, ...props }) => (
            <div className="my-4 overflow-x-auto rounded-md border border-foreground/25">
              <table
                className={cn(
                  'w-full border-separate border-spacing-0 text-sm leading-relaxed',
                  '[&_thead]:bg-muted',
                  '[&_td]:px-3 [&_td]:py-2 [&_td]:align-top',
                  '[&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold',
                  '[&_td]:border-r [&_td]:border-b [&_td]:border-foreground/20',
                  '[&_th]:border-r [&_th]:border-b [&_th]:border-foreground/20',
                  '[&_tbody_tr:last-child>td]:border-b-0 [&_tr>*:last-child]:border-r-0',
                  className
                )}
                {...props}
              />
            </div>
          ),
        }}
        remarkPlugins={renderMath ? remarkMathPlugins : remarkPlugins}
        rehypePlugins={renderMath ? rehypePlugins : undefined}
      >
        {markdownContent}
      </ReactMarkdown>
    </div>
  )
})
