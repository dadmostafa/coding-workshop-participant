import { toast } from 'react-toastify'

const base = {
  position: 'bottom-right',
  autoClose: 3000,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
}

export const toastSuccess = (msg) => toast.success(msg, {
  ...base,
  style: {
    backgroundColor: '#1e2029',
    border: '1px solid rgba(107,203,119,0.4)',
    borderRadius: '10px',
    color: '#e8eaf0',
  },
  progressStyle: { backgroundColor: '#6BCB77' },
  icon: '✓',
})

export const toastError = (msg) => toast.error(msg, {
  ...base,
  autoClose: 5000,
  style: {
    backgroundColor: '#1e2029',
    border: '1px solid rgba(255,107,107,0.4)',
    borderRadius: '10px',
    color: '#e8eaf0',
  },
  progressStyle: { backgroundColor: '#FF6B6B' },
  icon: '✗',
})

export const toastWarning = (msg) => toast.warning(msg, {
  ...base,
  style: {
    backgroundColor: '#1e2029',
    border: '1px solid rgba(255,209,102,0.4)',
    borderRadius: '10px',
    color: '#e8eaf0',
  },
  progressStyle: { backgroundColor: '#FFD166' },
  icon: '⚠',
})

export const toastInfo = (msg) => toast.info(msg, {
  ...base,
  style: {
    backgroundColor: '#1e2029',
    border: '1px solid rgba(116,185,255,0.4)',
    borderRadius: '10px',
    color: '#e8eaf0',
  },
  progressStyle: { backgroundColor: '#74B9FF' },
  icon: 'ℹ',
})

export const toastPromise = (promise, msgs = {}) => toast.promise(
  promise,
  {
    pending: { render: msgs.pending || 'Saving...', icon: '⏳' },
    success: {
      render: msgs.success || 'Done!',
      icon: '✓',
      style: {
        backgroundColor: '#1e2029',
        border: '1px solid rgba(107,203,119,0.4)',
        borderRadius: '10px',
        color: '#e8eaf0',
      },
      progressStyle: { backgroundColor: '#6BCB77' },
    },
    error: {
      render: ({ data }) => data?.response?.data?.error || msgs.error || 'Something went wrong',
      icon: '✗',
      style: {
        backgroundColor: '#1e2029',
        border: '1px solid rgba(255,107,107,0.4)',
        borderRadius: '10px',
        color: '#e8eaf0',
      },
      progressStyle: { backgroundColor: '#FF6B6B' },
    },
  },
  { ...base }
)
