import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { createClient } from '../features/clients/client-api.js';
import { ClientForm } from '../features/clients/client-form.jsx';
import { getClientErrorMessage } from '../features/clients/get-client-error-message.js';
import { useAuth } from '../features/auth/use-auth.js';

export function ClientCreatePage() {
  const { accessToken, clearSession } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  const handleSubmit = async (values) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setServerError('');
    try {
      const client = await createClient(values, accessToken);
      navigate(`/admin/clients/${encodeURIComponent(client.id)}`, { replace: true });
    } catch (error) {
      if (error?.code === 'AUTHENTICATION_REQUIRED') {
        clearSession();
        navigate('/login', { replace: true });
        return;
      }
      setServerError(getClientErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="client-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Client profiles</p>
          <h1>Add client</h1>
          <p>Create a business profile for a client in your organization.</p>
        </div>
      </div>
      <div className="content-card form-card">
        <ClientForm
          submitLabel="Add client"
          submittingLabel="Adding client..."
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          serverError={serverError}
        />
        <Link className="secondary-link" to="/admin/clients">Cancel</Link>
      </div>
    </section>
  );
}
