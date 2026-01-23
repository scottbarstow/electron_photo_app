import React, { useState, useCallback, useRef, useEffect } from 'react';

interface SplitPaneProps {
  leftPanel: React.ReactNode;
  rightPanel: React.ReactNode;
  defaultLeftWidth?: number;
  minLeftWidth?: number;
  maxLeftWidth?: number;
  className?: string;
}

export const SplitPane: React.FC<SplitPaneProps> = ({
  leftPanel,
  rightPanel,
  defaultLeftWidth = 280,
  minLeftWidth = 200,
  maxLeftWidth = 500,
  className = ''
}) => {
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startXRef.current = e.clientX;
    startWidthRef.current = leftWidth;
  }, [leftWidth]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const delta = e.clientX - startXRef.current;
    let newWidth = startWidthRef.current + delta;

    // Clamp to min/max bounds
    newWidth = Math.max(minLeftWidth, Math.min(maxLeftWidth, newWidth));

    setLeftWidth(newWidth);
  }, [isDragging, minLeftWidth, maxLeftWidth]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add global mouse event listeners for drag
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      // Prevent text selection while dragging
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    } else {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={containerRef}
      className={`flex h-full overflow-hidden ${className}`}
    >
      {/* Left Panel */}
      <div
        className="flex-shrink-0 h-full overflow-hidden"
        style={{ width: leftWidth }}
      >
        {leftPanel}
      </div>

      {/* Resize Handle */}
      <div
        className={`
          w-1 bg-gray-200 cursor-col-resize
          hover:bg-blue-400 active:bg-blue-500
          transition-colors duration-150
          flex-shrink-0
          ${isDragging ? 'bg-blue-500' : ''}
        `}
        onMouseDown={handleMouseDown}
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={leftWidth}
        aria-valuemin={minLeftWidth}
        aria-valuemax={maxLeftWidth}
      />

      {/* Right Panel */}
      <div className="flex-1 h-full overflow-hidden min-w-0">
        {rightPanel}
      </div>
    </div>
  );
};

// Vertical split variant
interface VerticalSplitPaneProps {
  topPanel: React.ReactNode;
  bottomPanel: React.ReactNode;
  defaultTopHeight?: number;
  minTopHeight?: number;
  maxTopHeight?: number;
  className?: string;
}

export const VerticalSplitPane: React.FC<VerticalSplitPaneProps> = ({
  topPanel,
  bottomPanel,
  defaultTopHeight = 300,
  minTopHeight = 100,
  maxTopHeight = 600,
  className = ''
}) => {
  const [topHeight, setTopHeight] = useState(defaultTopHeight);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startYRef.current = e.clientY;
    startHeightRef.current = topHeight;
  }, [topHeight]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const delta = e.clientY - startYRef.current;
    let newHeight = startHeightRef.current + delta;

    newHeight = Math.max(minTopHeight, Math.min(maxTopHeight, newHeight));

    setTopHeight(newHeight);
  }, [isDragging, minTopHeight, maxTopHeight]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'row-resize';
    } else {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div className={`flex flex-col h-full overflow-hidden ${className}`}>
      {/* Top Panel */}
      <div
        className="flex-shrink-0 w-full overflow-hidden"
        style={{ height: topHeight }}
      >
        {topPanel}
      </div>

      {/* Resize Handle */}
      <div
        className={`
          h-1 bg-gray-200 cursor-row-resize
          hover:bg-blue-400 active:bg-blue-500
          transition-colors duration-150
          flex-shrink-0
          ${isDragging ? 'bg-blue-500' : ''}
        `}
        onMouseDown={handleMouseDown}
        role="separator"
        aria-orientation="horizontal"
        aria-valuenow={topHeight}
        aria-valuemin={minTopHeight}
        aria-valuemax={maxTopHeight}
      />

      {/* Bottom Panel */}
      <div className="flex-1 w-full overflow-hidden min-h-0">
        {bottomPanel}
      </div>
    </div>
  );
};
