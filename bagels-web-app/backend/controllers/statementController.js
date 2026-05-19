const asyncHandler = require('express-async-handler');
const { StatementImportService, StatementParserService } = require('../services');

const uploadStatement = asyncHandler(async (req, res) => {
  let mapping = null;
  if (req.body.mapping) {
    try {
      mapping = JSON.parse(req.body.mapping);
    } catch (e) {
      console.warn('Invalid mapping JSON provided');
    }
  }

  const result = await StatementImportService.importStatement(req.user._id, req.file, {
    accountId: req.body.accountId,
    mapping,
  });
  res.status(201).json(result);
});

const previewStatement = asyncHandler(async (req, res) => {
  let mapping = null;
  if (req.body.mapping) {
    try {
      mapping = JSON.parse(req.body.mapping);
    } catch (e) {
      console.warn('Invalid mapping JSON provided for preview');
    }
  }
  const result = await StatementParserService.previewFile(req.file, mapping);
  res.status(200).json(result);
});

const listImports = asyncHandler(async (req, res) => {
  const imports = await StatementImportService.listImports(req.user._id, req.query.limit);
  res.status(200).json(imports);
});

const getImportDetail = asyncHandler(async (req, res) => {
  try {
    const detail = await StatementImportService.getImportDetail(req.user._id, req.params.batchId);
    res.status(200).json(detail);
  } catch (error) {
    if (error.message === 'Import batch not found') {
      return res.status(404).json({ message: 'Import batch not found' });
    }
    throw error;
  }
});

const deleteImport = asyncHandler(async (req, res) => {
  try {
    const result = await StatementImportService.deleteImport(req.user._id, req.params.batchId);
    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'Import batch not found') {
      return res.status(404).json({ message: 'Import batch not found' });
    }
    if (error.message === 'Import has already been reverted') {
      return res.status(409).json({ message: 'Import has already been reverted' });
    }
    throw error;
  }
});

module.exports = {
  uploadStatement,
  listImports,
  getImportDetail,
  deleteImport,
  previewStatement,
};
