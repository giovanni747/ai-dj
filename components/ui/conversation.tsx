'use client';

import { Button } from '@/components/ui/button';
import { ArrowDownIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { useCallback, forwardRef } from 'react';
import { StickToBottom, useStickToBottomContext } from 'use-stick-to-bottom';
import { cn } from '@/lib/utils';

export type ConversationProps = ComponentProps<typeof StickToBottom>;

export const Conversation = forwardRef<HTMLDivElement, ConversationProps>(
  ({ className, ...props }, ref) => {
    // Extract ref from props if provided
    const { style, ...restProps } = props;
    
    return (
      <StickToBottom
        ref={ref}
        className={cn('relative flex-1 overflow-y-auto no-scrollbar', className)}
        initial="smooth"
        resize="smooth"
        role="log"
        style={{ 
          overscrollBehavior: 'none', // Prevent overscroll bounce
          scrollBehavior: 'smooth',
          ...style 
        }}
        {...restProps}
      />
    );
  }
);

Conversation.displayName = 'Conversation';

export type ConversationContentProps = ComponentProps<
  typeof StickToBottom.Content
>;

export const ConversationContent = ({
  className,
  ...props
}: ConversationContentProps) => {
  // Extract padding classes from className to allow overrides
  const hasCustomPadding = className?.includes('pb-') || className?.includes('pt-') || className?.includes('px-') || className?.includes('py-');
  const basePadding = hasCustomPadding ? '' : 'p-4';
  
  return (
    <StickToBottom.Content className={cn(basePadding, 'no-scrollbar', className)} {...props} />
  );
};

export type ConversationScrollButtonProps = ComponentProps<typeof Button>;

export const ConversationScrollButton = ({
  className,
  ...props
}: ConversationScrollButtonProps) => {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  const handleScrollToBottom = useCallback(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  return (
    !isAtBottom && (
      <Button
        className={cn(
          'absolute bottom-4 left-[50%] translate-x-[-50%] rounded-full',
          className,
        )}
        onClick={handleScrollToBottom}
        size="icon"
        type="button"
        variant="outline"
        {...props}
      >
        <ArrowDownIcon className="size-4" />
      </Button>
    )
  );
};

