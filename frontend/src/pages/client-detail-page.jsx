import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '../features/auth/use-auth.js';
import { getClient, updateClient } from '../features/clients/client-api.js';
import { CLIENT_STATUS } from '../features/clients/client.constants.js';
import { ClientForm } from '../features/clients/client-form.jsx';
import { getClientErrorMessage } from '../features/clients/get-client-error-message.js';

export function ClientDetailPage() {
  const { clientId } = useParams();
  const { accessToken, clearSession } = useAuth();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updateError, setUpdateError] = useState('');
  const [confirmingStatus, setConfirmingStatus] = useState(false);

  const handleAuthenticationFailure = useCallback((error) => {
    if (error?.code !== 'AUTHENTICATION_REQUIRED') return false;
    clearSession();
    navigate('/login', { replace: true });
    return true;
  }, [clearSession, navigate]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      setClient(await getClient(clientId, accessToken));
    } catch (error) {
      if (!handleAuthenticationFailure(error)) {
        setLoadError(getClientErrorMessage(error));
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, clientId, handleAuthenticationFailure]);

  useEffect(() => {
    load();
  }, [load]);

  const initialValues = useMemo(() => client ? {
    firstName: client.firstName,
    lastName: client.lastName,
    email: client.email,
    companyName: client.companyName ?? '',
  } : undefined, [client]);

  const saveDetails = async (values) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setUpdateError('');
    const updates = {
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
    };
    if (values.companyName !== undefined) updates.companyName = values.companyName;
    else if (client.companyName) updates.companyName = null;
    try {
      setClient(await updateClient(clientId, updates, accessToken));
      setEditing(false);
    } catch (error) {
      if (!handleAuthenticationFailure(error)) {
        setUpdateError(getClientErrorMessage(error));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const changeStatus = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setUpdateError('');
    const status = client.status === CLIENT_STATUS.ACTIVE
      ? CLIENT_STATUS.INACTIVE
      : CLIENT_STATUS.ACTIVE;
    try {
      setClient(await updateClient(clientId, { status }, accessToken));
      setConfirmingStatus(false);
    } catch (error) {
      if (!handleAuthenticationFailure(error)) {
        setUpdateError(getClientErrorMessage(error));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <section className="client-page">
        <h1>Client details</h1>
        <div className="content-state" role="status">Loading client...</div>
      </section>
    );
  }
  if (loadError) {
    return (
      <section className="client-page">
        <h1>Client details</h1>
        <div className="content-state error-state" role="alert"><p>{loadError}</p></div>
        <Link className="secondary-link" to="/admin/clients">Back to clients</Link>
      </section>
    );
  }
  if (!client) return null;

  const isActive = client.status === CLIENT_STATUS.ACTIVE;
  const statusAction = isActive ? 'Deactivate client' : 'Activate client';

  return (
    <section className="client-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Client profile</p>
          <h1>{client.firstName} {client.lastName}</h1>
          <p>View and maintain this client’s profile details.</p>
        </div>
        {!editing && <button type="button" onClick={() => { setEditing(true); setUpdateError(''); }}>Edit client</button>}
      </div>

      {editing ? (
        <div className="content-card form-card">
          <h2>Edit client details</h2>
          <ClientForm
            initialValues={initialValues}
            submitLabel="Save changes"
            submittingLabel="Saving changes..."
            onSubmit={saveDetails}
            isSubmitting={isSubmitting}
            serverError={updateError}
          />
          <button
            className="text-button"
            type="button"
            disabled={isSubmitting}
            onClick={() => { setEditing(false); setUpdateError(''); }}
          >
            Cancel editing
          </button>
        </div>
      ) : (
        <>
          {updateError && <div className="server-error" role="alert">{updateError}</div>}
          <div className="content-card">
            <dl className="detail-grid">
              <Detail label="Name" value={`${client.firstName} ${client.lastName}`} />
              <Detail label="Email" value={client.email} />
              <Detail label="Company" value={client.companyName || 'Not provided'} />
              <Detail label="Status" value={<span className={`status-badge status-${client.status}`}>{isActive ? 'Active' : 'Inactive'}</span>} />
              <Detail label="Created" value={formatDate(client.createdAt)} />
              <Detail label="Updated" value={formatDate(client.updatedAt)} />
            </dl>
          </div>

          <div className="content-card status-action">
            <h2>Client status</h2>
            <p>Inactive clients remain stored and can be activated again later.</p>
            {!confirmingStatus ? (
              <button type="button" className={isActive ? 'danger-button' : ''} onClick={() => setConfirmingStatus(true)}>
                {statusAction}
              </button>
            ) : (
              <section className="confirmation-panel" aria-labelledby="status-confirmation-title">
                <h3 id="status-confirmation-title">Confirm {statusAction.toLowerCase()}</h3>
                <p>
                  {isActive
                    ? 'Deactivate this client? The profile will remain stored.'
                    : 'Activate this client and make the profile active again?'}
                </p>
                <div className="button-row">
                  <button type="button" disabled={isSubmitting} onClick={changeStatus}>
                    {isSubmitting ? 'Updating status...' : `Yes, ${statusAction.toLowerCase()}`}
                  </button>
                  <button type="button" className="secondary-button" disabled={isSubmitting} onClick={() => setConfirmingStatus(false)}>
                    Cancel
                  </button>
                </div>
              </section>
            )}
          </div>
        </>
      )}
      <Link className="secondary-link back-link" to="/admin/clients">Back to clients</Link>
    </section>
  );
}

function Detail({ label, value }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Not available'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}
