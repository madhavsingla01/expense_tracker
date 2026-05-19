const express = require('express');
const multer = require('multer');
const { protect } = require('../middleware/authMiddleware');
const { uploadStatement, listImports, getImportDetail, deleteImport, previewStatement } = require('../controllers/statementController');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const name = String(file.originalname || '').toLowerCase();
    const mime = String(file.mimetype || '').toLowerCase();
    const isCsv = name.endsWith('.csv') || mime.includes('csv');
    const isPdf = name.endsWith('.pdf') || mime.includes('pdf');
    const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls') || mime.includes('excel') || mime.includes('spreadsheet');
    if (isCsv || isPdf || isExcel) {
      cb(null, true);
      return;
    }
    cb(new Error('Only PDF, CSV, and Excel statement files are allowed.'));
  },
});

router.get('/imports', protect, listImports);
router.get('/imports/:batchId', protect, getImportDetail);
router.delete('/imports/:batchId', protect, deleteImport);
router.post('/upload', protect, upload.single('statement'), uploadStatement);
router.post('/preview', protect, upload.single('statement'), previewStatement);

module.exports = router;
