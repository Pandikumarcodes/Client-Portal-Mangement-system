import { useEffect, useRef, useState } from 'react';
import { formatProjectFileSize } from './file-format.js';
import {
  PROJECT_FILE_ACCEPT,
  PROJECT_FILE_DESCRIPTION_MAX_LENGTH,
  PROJECT_FILE_MAX_SIZE_BYTES,
  PROJECT_FILE_MIME_TYPES,
} from './project-file.constants.js';

function validate(fileList, description) {
  const errors = {};
  if (!fileList || fileList.length === 0) {
    errors.file = 'Select a file to upload.';
  } else if (fileList.length !== 1) {
    errors.file = 'Select exactly one file.';
  } else {
    const file = fileList[0];
    if (!Number.isFinite(file.size) || file.size <= 0) {
      errors.file = 'Select a non-empty file.';
    } else if (file.size > PROJECT_FILE_MAX_SIZE_BYTES) {
      errors.file = 'The file must not exceed 10 MiB.';
    } else if (!PROJECT_FILE_MIME_TYPES.includes(file.type)) {
      errors.file = 'Select a supported PDF, PNG, JPEG, text, CSV, Word, or Excel file.';
    }
  }
  if (description.trim().length > PROJECT_FILE_DESCRIPTION_MAX_LENGTH) {
    errors.description = 'Description must not exceed 500 characters.';
  }
  return errors;
}

export function ProjectFileUploadForm({
  onSubmit,
  isSubmitting,
  serverError,
  serverErrorCode,
  onSuccessKey = 0,
}) {
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState({});
  useEffect(() => {
    setSelectedFile(null);
    setDescription('');
    setErrors({});
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [onSuccessKey]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    const fileList = fileInputRef.current?.files;
    const nextErrors = validate(fileList, description);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    onSubmit({
      file: fileList[0],
      description: description.trim() || undefined,
    });
  };

  const serverFileError = [
    'PROJECT_FILE_REQUIRED',
    'PROJECT_FILE_TYPE_NOT_ALLOWED',
    'PROJECT_FILE_TOO_LARGE',
    'PROJECT_FILE_UPLOAD_INVALID',
  ].includes(serverErrorCode) ? serverError : '';

  return (
    <form className="client-form project-file-form" onSubmit={handleSubmit} noValidate>
      {serverError && !serverFileError && (
        <div className="server-error" role="alert">{serverError}</div>
      )}
      <div className="form-field">
        <label htmlFor="project-file">File</label>
        <input
          ref={fileInputRef}
          id="project-file"
          name="file"
          type="file"
          accept={PROJECT_FILE_ACCEPT}
          onChange={(event) => {
            setSelectedFile(event.target.files?.[0] ?? null);
            setErrors((current) => ({ ...current, file: undefined }));
          }}
          aria-invalid={Boolean(errors.file || serverFileError)}
          aria-describedby={
            errors.file || serverFileError ? 'project-file-error' : 'project-file-help'
          }
        />
        <p id="project-file-help" className="field-help">
          One PDF, PNG, JPEG, text, CSV, Word, or Excel file, up to 10 MiB.
        </p>
        {(errors.file || serverFileError) && (
          <p id="project-file-error" className="field-error" role="alert">
            {errors.file || serverFileError}
          </p>
        )}
        {selectedFile && (
          <p className="selected-file">
            Selected: <span>{selectedFile.name}</span> ({formatProjectFileSize(selectedFile.size)})
          </p>
        )}
      </div>
      <div className="form-field">
        <label htmlFor="project-file-description">Description (optional)</label>
        <textarea
          id="project-file-description"
          name="description"
          rows="4"
          maxLength={PROJECT_FILE_DESCRIPTION_MAX_LENGTH + 1}
          value={description}
          onChange={(event) => {
            setDescription(event.target.value);
            setErrors((current) => ({ ...current, description: undefined }));
          }}
          aria-invalid={Boolean(errors.description)}
          aria-describedby={errors.description ? 'project-file-description-error' : undefined}
        />
        {errors.description && (
          <p id="project-file-description-error" className="field-error">
            {errors.description}
          </p>
        )}
      </div>
      <button className="form-submit" type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Uploading...' : 'Upload File'}
      </button>
    </form>
  );
}
