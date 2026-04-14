import React, { useRef, useCallback } from 'react'
import Editor from '@monaco-editor/react'

/**
 * VS Code 风格的 JSON 编辑器组件
 * 
 * Props:
 *   value      - 当前 JSON 文本
 *   onChange   - 文本变化回调
 *   height     - 编辑器高度（默认 400）
 *   readOnly   - 是否只读（默认 false）
 *   minimap    - 是否显示缩略图（默认 false）
 */
export default function JsonEditor({
  value,
  onChange,
  height = 400,
  readOnly = false,
  minimap = false,
}) {
  const editorRef = useRef(null)

  const handleMount = useCallback((editor, monaco) => {
    editorRef.current = editor

    // 配置 JSON 语言的诊断选项
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: false,
      schemaValidation: 'error',
      trailingCommas: 'error',
    })

    // 自动格式化（仅初始加载时）
    setTimeout(() => {
      editor.getAction('editor.action.formatDocument')?.run()
    }, 300)
  }, [])

  const handleChange = useCallback((val) => {
    onChange?.(val || '')
  }, [onChange])

  return (
    <div style={{
      border: '1px solid #d9d9d9',
      borderRadius: 8,
      overflow: 'hidden',
      background: '#1e1e1e',
    }}>
      <Editor
        height={height}
        language="json"
        theme="vs-dark"
        value={value}
        onChange={handleChange}
        onMount={handleMount}
        options={{
          readOnly,
          minimap: { enabled: minimap },
          fontSize: 13,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
          fontLigatures: true,
          lineNumbers: 'on',
          tabSize: 2,
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          formatOnPaste: true,
          formatOnType: true,
          folding: true,
          foldingStrategy: 'indentation',
          showFoldingControls: 'always',
          bracketPairColorization: { enabled: true },
          guides: {
            bracketPairs: true,
            indentation: true,
          },
          renderLineHighlight: 'all',
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          padding: { top: 12, bottom: 12 },
          scrollbar: {
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
            verticalSliderSize: 8,
          },
          suggest: {
            showWords: false,
          },
          quickSuggestions: false,
          renderWhitespace: 'selection',
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          overviewRulerBorder: false,
        }}
      />
    </div>
  )
}
