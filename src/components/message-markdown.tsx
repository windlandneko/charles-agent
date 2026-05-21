import { cjk } from '@streamdown/cjk'
import { code } from '@streamdown/code'
import { createMathPlugin } from '@streamdown/math'
import { mermaid } from '@streamdown/mermaid'
import { memo, useMemo } from 'react'
import { Streamdown } from 'streamdown'

import 'katex/dist/katex.min.css'

type MessageMarkdownProps = {
  content: string
  className?: string
  streaming?: boolean
}

const streamdownPlugins = {
  cjk,
  code,
  math: createMathPlugin({
    singleDollarTextMath: true,
  }),
  mermaid,
}
const linkSafety = { enabled: true }

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
        .replace(/\\\[([\s\S]*?)\\\]/g, (_, formula) => {
          return '\n\n$$\n' + formula.trim() + '\n$$\n\n'
        })
        .replace(/\\\(([\s\S]*?)\\\)/g, (_, formula) => {
          return '$' + formula.trim() + '$'
        })
    })
    .join('')
}

export const MessageMarkdown = memo(function MessageMarkdown({
  content,
  className,
  streaming = false,
}: MessageMarkdownProps) {
  const markdownContent = useMemo(
    () => normalizeMathDelimiters(content),
    [content]
  )

  return (
    <Streamdown
      className={className}
      controls={true}
      isAnimating={streaming}
      lineNumbers={true}
      linkSafety={linkSafety}
      mode={streaming ? 'streaming' : 'static'}
      plugins={streamdownPlugins}
    >
      {markdownContent}
    </Streamdown>
  )
})
