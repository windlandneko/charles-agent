import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

import { cn } from '@/lib/utils'

type MessageMarkdownProps = {
  content: string
  className?: string
}

const remarkPlugins = [remarkGfm, remarkMath]
const rehypePlugins = [rehypeKatex]

export const MessageMarkdown = memo(function MessageMarkdown({
  content,
  className,
}: MessageMarkdownProps) {
  return (
    <div
      className={cn(
        'prose prose-neutral dark:prose-invert max-w-none whitespace-normal',
        'prose-p:my-3 prose-p:first:mt-0 prose-p:last:mb-0',
        'prose-headings:font-heading prose-headings:tracking-normal',
        'prose-ul:my-3 prose-ol:my-3 prose-li:my-1',
        'prose-pre:overflow-x-auto prose-pre:rounded-lg prose-pre:bg-muted prose-pre:p-4',
        'prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.9em] prose-code:before:content-none prose-code:after:content-none',
        'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
})
