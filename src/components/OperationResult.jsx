import React, { useEffect, useId, useRef, useSyncExternalStore } from 'react';
import { dismissFeedback, getFeedbackSnapshot, subscribeToFeedback } from '../lib/operation-feedback';
import './operation-result.css';

export default function OperationResult() {
  const messages = useSyncExternalStore(subscribeToFeedback, getFeedbackSnapshot);
  const result = messages[0];
  return result ? <ResultDialog key={result.id} result={result}/> : null;
}

function ResultDialog({ result }) {
  const ref = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  const close = () => dismissFeedback(result.id);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return <dialog ref={ref} className="operation-result" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={event => { event.preventDefault(); close(); }}>
    <button className="operation-result-close" type="button" onClick={close} aria-label="Cerrar mensaje de resultado">×</button>
    <div className="operation-result-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="32" height="32" fill="none"><path d="m5 12 4 4L19 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </div>
    <span className="operation-result-label">OPERACIÓN COMPLETADA</span>
    <h2 id={titleId}>{result.title}</h2>
    <p id={descriptionId}>{result.message}</p>
    <button className="operation-result-accept" type="button" autoFocus onClick={close}>Entendido</button>
  </dialog>;
}
