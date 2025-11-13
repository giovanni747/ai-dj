"use client"

import { useEffect, useRef } from "react"
import type React from "react"
import { useInView } from "motion/react"
import { annotate } from "rough-notation"
import { type RoughAnnotation } from "rough-notation/lib/model"

type AnnotationAction =
  | "highlight"
  | "underline"
  | "box"
  | "circle"
  | "strike-through"
  | "crossed-off"
  | "bracket"

interface HighlighterProps {
  children: React.ReactNode
  action?: AnnotationAction
  color?: string
  strokeWidth?: number
  animationDuration?: number
  iterations?: number
  padding?: number
  multiline?: boolean
  isView?: boolean
}

export function Highlighter({
  children,
  action = "highlight",
  color = "#ffd1dc",
  strokeWidth = 1.5,
  animationDuration = 600,
  iterations = 2,
  padding = 2,
  multiline = true,
  isView = false,
}: HighlighterProps) {
  const elementRef = useRef<HTMLSpanElement>(null)
  const annotationRef = useRef<RoughAnnotation | null>(null)

  const isInView = useInView(elementRef, {
    once: true,
    margin: "-10%",
  })

  // If isView is false, always show. If isView is true, wait for inView
  const shouldShow = !isView || isInView

  useEffect(() => {
    if (!shouldShow) return

    const element = elementRef.current
    if (!element) return

    let mounted = true
    let innerFrameId: number | null = null
    let resizeObserver: ResizeObserver | null = null
    let scrollContainers: (Element | Window)[] = []
    let scrollHandler: (() => void) | null = null

    // Find all scrollable parent containers
    const findScrollContainers = (el: HTMLElement): (Element | Window)[] => {
      const containers: (Element | Window)[] = [window]
      let current: HTMLElement | null = el

      while (current && current !== document.body) {
        const style = window.getComputedStyle(current)
        if (
          style.overflow === 'auto' ||
          style.overflow === 'scroll' ||
          style.overflowY === 'auto' ||
          style.overflowY === 'scroll' ||
          style.overflowX === 'auto' ||
          style.overflowX === 'scroll'
        ) {
          containers.push(current)
        }
        current = current.parentElement
      }

      return containers
    }

    // Check if element is visible in scroll container
    const isElementVisible = (el: HTMLElement, container: Element | Window): boolean => {
      if (container === window) {
        const rect = el.getBoundingClientRect()
        return (
          rect.top < window.innerHeight &&
          rect.bottom > 0 &&
          rect.left < window.innerWidth &&
          rect.right > 0
        )
      } else {
        const elRect = el.getBoundingClientRect()
        const containerRect = (container as Element).getBoundingClientRect()
        return (
          elRect.top < containerRect.bottom &&
          elRect.bottom > containerRect.top &&
          elRect.left < containerRect.right &&
          elRect.right > containerRect.left
        )
      }
    }

    // Use double requestAnimationFrame to ensure DOM is fully laid out
    const frameId = requestAnimationFrame(() => {
      innerFrameId = requestAnimationFrame(() => {
        if (!mounted) return

        // Ensure element is still mounted and has content
        const currentElement = elementRef.current
        if (!currentElement || !currentElement.textContent) {
          return
        }

        // Find scroll containers
        scrollContainers = findScrollContainers(currentElement)

        // Get the most relevant scroll container (prefer non-window container with overflow)
        const getScrollContainer = (): Element | Window => {
          // Find the closest scroll container that's not the window
          for (const container of scrollContainers) {
            if (container !== window) {
              const style = window.getComputedStyle(container as Element)
              if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
                return container
              }
            }
          }
          return window
        }

        // Update annotation visibility based on scroll position
        const updateAnnotationVisibility = () => {
          if (!annotationRef.current || !mounted || !currentElement) return

          const scrollContainer = getScrollContainer()
          
          // For non-window containers, check visibility within that container
          let isVisible: boolean
          if (scrollContainer === window) {
            isVisible = isElementVisible(currentElement, window)
          } else {
            // Check if element is visible within the scroll container's viewport
            const elRect = currentElement.getBoundingClientRect()
            const containerRect = (scrollContainer as Element).getBoundingClientRect()
            
            // Element is visible if it overlaps with the container's visible area
            isVisible = (
              elRect.top < containerRect.bottom &&
              elRect.bottom > containerRect.top &&
              elRect.left < containerRect.right &&
              elRect.right > containerRect.left
            )
          }

          // Use requestAnimationFrame to avoid flickering
          requestAnimationFrame(() => {
            if (!annotationRef.current || !mounted) return
            
            if (isVisible) {
              annotationRef.current.show()
            } else {
              // Hide annotation when outside visible area to prevent overflow
              annotationRef.current.hide()
            }
          })
        }

        // Throttled scroll handler
        let scrollTimeout: number | null = null
        scrollHandler = () => {
          if (scrollTimeout) return
          scrollTimeout = requestAnimationFrame(() => {
            updateAnnotationVisibility()
            scrollTimeout = null
          })
        }

        const annotationConfig = {
          type: action,
          color,
          strokeWidth,
          animationDuration,
          iterations,
          padding,
          multiline,
        }

        try {
          const annotation = annotate(currentElement, annotationConfig)
          annotationRef.current = annotation
          
          // Initial visibility check
          updateAnnotationVisibility()

          // Add scroll listeners to all scroll containers
          scrollContainers.forEach(container => {
            container.addEventListener('scroll', scrollHandler!, { passive: true })
          })

          resizeObserver = new ResizeObserver(() => {
            if (annotationRef.current && mounted) {
              updateAnnotationVisibility()
            }
          })

          resizeObserver.observe(currentElement)
          resizeObserver.observe(document.body)
        } catch (error) {
          console.error("Error creating annotation:", error)
        }
      })
    })

    return () => {
      mounted = false
      if (frameId) cancelAnimationFrame(frameId)
      if (innerFrameId) cancelAnimationFrame(innerFrameId)
      
      // Remove scroll listeners
      if (scrollHandler) {
        scrollContainers.forEach(container => {
          container.removeEventListener('scroll', scrollHandler!)
        })
      }

      if (annotationRef.current) {
        annotationRef.current.remove()
        annotationRef.current = null
      }
      if (resizeObserver) {
        resizeObserver.disconnect()
      }
    }
  }, [
    shouldShow,
    action,
    color,
    strokeWidth,
    animationDuration,
    iterations,
    padding,
    multiline,
  ])

  return (
    <span ref={elementRef} className="relative inline bg-transparent">
      {children}
    </span>
  )
}
