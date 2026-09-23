import { useState } from 'react'

const allowedNames = [
  'employees.json',
  'events.json',
  'skills.json',
  'activity_history.csv',
]

function DataImport({ onImport }) {
  const [files, setFiles] = useState([])
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [uploading, setUploading] = useState(false)

  function handleSelection(event) {
    const selectedFiles = Array.from(event.target.files ?? [])

    setError('')
    setResult(null)

    const invalidFile = selectedFiles.find(
      (file) => !allowedNames.includes(file.name),
    )

    if (invalidFile) {
      setFiles([])
      setError(
        `"${invalidFile.name}" is not supported. Use the filenames listed below.`,
      )
      event.target.value = ''
      return
    }

    const uniqueNames = new Set(selectedFiles.map((file) => file.name))

    if (uniqueNames.size !== selectedFiles.length) {
      setFiles([])
      setError('Select only one file for each dataset type.')
      event.target.value = ''
      return
    }

    setFiles(selectedFiles)
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!files.length || !onImport || uploading) return

    setUploading(true)
    setError('')
    setResult(null)

    try {
      const response = await onImport(files)
      setResult(response)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Import failed. Please try again.',
      )
    } finally {
      setUploading(false)
    }
  }

  return (
    <section className="card import-card">
      <p className="eyebrow">DATASET</p>
      <h2>Import test data</h2>

      <p className="assessment-note">
        Select one or more starter-kit files. The backend will validate
        them before updating the dataset.
      </p>

      <form onSubmit={handleSubmit}>
        <label className="file-label" htmlFor="dataset-files">
          Choose dataset files
        </label>

        <input
          id="dataset-files"
          className="file-input"
          type="file"
          accept=".json,.csv"
          multiple
          disabled={uploading}
          onChange={handleSelection}
          aria-describedby="accepted-files"
        />

        <p id="accepted-files" className="accepted-files">
          Accepted filenames: employees.json, events.json, skills.json,
          activity_history.csv.
        </p>

        {files.length > 0 && (
          <ul className="selected-files">
            {files.map((file) => (
              <li key={file.name}>
                <span>{file.name}</span>
                <span>{Math.ceil(file.size / 1024)} KB</span>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p className="recommendation-error" role="alert">
            {error}
          </p>
        )}

        {result && (
          <div className="import-success" role="status">
            <strong>Import completed.</strong>
            <p>
              Loaded: {result.loaded.employees} employee records,{' '}
              {result.loaded.events} events, {result.loaded.skills} skills
              and {result.loaded.history} history records.
            </p>
          </div>
        )}

        <button
          className="complete-button import-button"
          type="submit"
          disabled={!files.length || !onImport || uploading}
        >
          {uploading ? 'Importing…' : 'Import selected files'}
        </button>

        {!onImport && (
          <p className="assessment-note">
            File selection is ready. Import will be available when the
            backend is connected.
          </p>
        )}
      </form>
    </section>
  )
}

export default DataImport