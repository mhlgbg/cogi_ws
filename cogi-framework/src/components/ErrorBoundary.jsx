import React from 'react'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(err) {
    return { hasError: true, error: err }
  }

  componentDidCatch(error, info) {
    // log and swallow
    try { console.error('[ErrorBoundary] caught', error, info) } catch (e) {}
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20 }}>
          <h4>Đã có lỗi xảy ra</h4>
          <div style={{ color: '#666', whiteSpace: 'pre-wrap' }}>{String(this.state.error)}</div>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
