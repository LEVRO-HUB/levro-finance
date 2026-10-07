import './invoice.css'
import { companyProfile, invoiceBreakdown, rupeesInWords } from '../../lib/company'
import { formatDate } from '../../lib/format'

const money = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const longDate = (iso) => {
  if (!iso) return ''
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number)
  const month = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m - 1]
  return month ? `${d} ${month} ${y}` : formatDate(iso)
}
const logo = `${import.meta.env.BASE_URL}logo-invoice.png`
const Sep = () => <span className="sep">|</span>
const joined = (parts) => parts.filter(Boolean).flatMap((p, i) => (i ? [<Sep key={`s${i}`} />, p] : [p]))

// One Levrotec invoice. `invoice` is the stored record; `project` and `settings`
// supply the project reference and (for invoices issued before company details
// were stored with each invoice) the current company profile.
export function InvoiceDocument({ invoice, project, settings }) {
  const d = invoice.details ?? {}
  const co = d.company ?? companyProfile(settings)
  const items = d.items ?? []
  const b = invoiceBreakdown(d)
  const pay = d.pay ?? {}
  const payRows = [['Account name', pay.account_name], ['Bank', pay.bank], ['Account no.', pay.account_no], ['IFSC', pay.ifsc], ['UPI', pay.upi]].filter(([, v]) => v)
  const meta = [
    ['Invoice number', invoice.invoice_number], ['Invoice date', longDate(invoice.invoice_date)], ['Due date', longDate(invoice.due_date)],
    ['Billing period', d.billing_period], ['Payment terms', d.payment_terms], ['Project', project?.name], ['Project ref.', project?.project_number],
  ].filter(([, v]) => v)
  const ids = [co.gstin && `GSTIN ${co.gstin}`, co.pan && `PAN ${co.pan}`]
  const showTaxable = b.discount > 0 || b.taxes.length > 0
  return (
    <div className="lv-inv">
      <div className="page">
        <header className="head">
          <div className="brand">
            <img src={logo} alt="" />
            <div>
              <h1>{co.name}</h1>
              {co.tagline && <p>{co.tagline}</p>}
            </div>
          </div>
          <div className="doc"><div className="word">INVOICE</div><div className="no num">{invoice.invoice_number}</div></div>
        </header>

        {/* the outer table only exists so every printed page keeps a top and bottom margin */}
        <table className="flow"><thead><tr><td className="gap" /></tr></thead><tfoot><tr><td className="gap" /></tr></tfoot><tbody><tr><td>
          <div className="body">
            <section className="top">
              <div className="to">
                <span className="label">Billed to</span>
                <h2>{d.bill_to_name}</h2>
                {d.bill_to_line && <p>{d.bill_to_line}</p>}
                {d.bill_to_address && <p style={{ whiteSpace: 'pre-line' }}>{d.bill_to_address}</p>}
                {d.bill_to_email && <p>{d.bill_to_email}</p>}
                {d.bill_to_gstin && <p>GSTIN {d.bill_to_gstin}</p>}
              </div>
              <dl className="meta">{meta.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className="num">{v}</dd></div>)}</dl>
            </section>

            <table className="items">
              <thead><tr><th>#</th><th>Description</th><th className="r">Qty</th><th className="r">Rate (₹)</th><th className="r">Amount (₹)</th></tr></thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i}>
                    <td className="n num">{String(i + 1).padStart(2, '0')}</td>
                    <td><div className="t">{it.title}</div>{it.description && <div className="d" style={{ whiteSpace: 'pre-line' }}>{it.description}</div>}</td>
                    <td className="r num">{Number(it.qty)}</td><td className="r num">{money(it.rate)}</td><td className="r num amt">{money(Number(it.qty) * Number(it.rate))}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <section className="sum keep">
              <div className="words"><span className="label">Amount in words</span><p>{rupeesInWords(b.total)}</p></div>
              <div className="totals">
                <div className="row"><span>Subtotal</span><span className="num">₹{money(b.subtotal)}</span></div>
                {b.discount > 0 && <div className="row"><span>Discount</span><span className="num">− ₹{money(b.discount)}</span></div>}
                {showTaxable && <div className="row"><span>Taxable amount</span><span className="num">₹{money(b.taxable)}</span></div>}
                {b.taxes.map((t) => <div className="row" key={t.key}><span>{t.label} ({t.rate}%)</span><span className="num">₹{money(t.amount)}</span></div>)}
                {b.taxes.length > 1 && <div className="row"><span>Total tax</span><span className="num">₹{money(b.tax)}</span></div>}
                <div className="row grand"><span>Total Due</span><span className="num">₹{money(b.total)}</span></div>
              </div>
            </section>

            {invoice.notes && <section className="note keep"><span className="label">Note</span><p style={{ whiteSpace: 'pre-line' }}>{invoice.notes}</p></section>}

            <section className="foot keep">
              <div className="pay">
                {payRows.length > 0 && <><span className="label">Payment details</span><dl>{payRows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></>}
              </div>
              <div className="sign">
                <div className="for">For {co.name}</div>
                <div className="space" />
                {co.signatory && <div className="name">{co.signatory}</div>}
                {co.signatory_role && <div className="role">{co.signatory_role}</div>}
                <div className="auth">Authorised signatory</div>
              </div>
            </section>

          </div>
        </td></tr></tbody></table>
        <p className="conf keep">This invoice and its contents are confidential and intended solely for the authorised representatives of {d.bill_to_name}. Unauthorised circulation or disclosure without written authorisation from {co.name} is prohibited.</p>
        <footer className="strip keep">
          <span><b>{co.name}</b>{co.address && <><Sep />{co.address}</>}</span>
          <span>{joined([co.email, co.phone, co.website, ...ids])}</span>
        </footer>
      </div>
    </div>
  )
}
