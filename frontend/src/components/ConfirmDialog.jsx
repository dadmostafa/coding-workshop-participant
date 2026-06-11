import {
  Dialog, DialogTitle, DialogContent, DialogContentText,
  DialogActions, Button, Paper,
} from '@mui/material'
import { motion } from 'framer-motion'

export default function ConfirmDialog({ open, title, message, onConfirm, onCancel }) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="xs"
      fullWidth
      PaperComponent={({ children, ...props }) => (
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <Paper {...props}>{children}</Paper>
        </motion.div>
      )}
    >
      <DialogTitle sx={{ color: 'text.primary' }}>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ color: 'text.secondary' }}>{message}</DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} sx={{ color: '#8b8fa8' }}>Cancel</Button>
        <Button onClick={onConfirm} variant="contained"
          sx={{ bgcolor: '#FF6B6B', color: '#fff', fontWeight: 700,
            '&:hover': { bgcolor: '#e05555' } }}>
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
  )
}
