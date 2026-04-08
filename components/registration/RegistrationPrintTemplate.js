"use client";

function v(x) {
  return x == null ? "" : String(x);
}

function field(registration, ...keys) {
  for (const key of keys) {
    const value = registration?.[key];
    if (value != null && String(value).trim() !== "") return String(value);
  }
  return "";
}

function nationalityFromRegistration(registration) {
  const direct = field(registration, "nationality");
  if (direct) return direct;
  const notes = String(registration?.notes || "");
  const m = notes.match(/\[NATIONALITY\]\s*(.+)/i);
  if (m?.[1]) return String(m[1]).trim();
  return field(registration, "country");
}

export default function RegistrationPrintTemplate({ registration }) {
  const booking = "";
  const arrival = field(registration, "arrival_date");
  const departure = field(registration, "departure_date");
  const lastName = field(registration, "last_name");
  const firstName = field(registration, "first_name");
  const birth = field(registration, "birth_date");
  const nationality = nationalityFromRegistration(registration);
  const street = field(registration, "street");
  const postcode = field(registration, "postcode");
  const city = field(registration, "city");
  const country = field(registration, "country");
  const plate = field(registration, "license_plate");
  const idNo = field(registration, "id_number");
  const phone = field(registration, "phone");
  const email = field(registration, "email");
  const adults = field(registration, "adults_count");
  const children = field(registration, "children_count");
  const infants = field(registration, "infants_count");
  const dogs = field(registration, "dogs_count");
  const petsOther = field(registration, "other_pets_count");
  const payment = field(registration, "payment_method");

  return (
    <>
      <div id="registration-print-area" className="registration-print-root">
        <div className="registration-print-sheet">
          <div className="rp-header">
            <div className="rp-logo-row">
              <div className="rp-logo" />
              <div>
                <div className="rp-brand">Azur Camping</div>
                <div className="rp-country">Deutschland</div>
              </div>
            </div>
            <div className="rp-address">Azur Camping Regensburg, Weinweg 40, 93049 Regensburg</div>
            <div className="rp-title">Gästeanmeldung/Guest Registration</div>
          </div>

          <table className="rp-main-table">
            <tbody>
              <tr>
                <td className="rp-wide" colSpan={2}>
                  <span className="rp-label-large">Buchungsnummer:</span> <span className="rp-value">{v(booking)}</span>
                </td>
              </tr>
              <tr>
                <td>
                  <div className="rp-label">Anreisedatum/Date of arrival</div>
                  <div className="rp-value">{v(arrival)}</div>
                </td>
                <td>
                  <div className="rp-label">Abreisedatum/Date of departure</div>
                  <div className="rp-value">{v(departure)}</div>
                </td>
              </tr>
              <tr>
                <td>
                  <div className="rp-label">Name/Last name</div>
                  <div className="rp-value">{v(lastName)}</div>
                </td>
                <td>
                  <div className="rp-label">Vorname/First name</div>
                  <div className="rp-value">{v(firstName)}</div>
                </td>
              </tr>
              <tr>
                <td>
                  <div className="rp-label">Geburtsdatum/Date of birth</div>
                  <div className="rp-value">{v(birth)}</div>
                </td>
                <td>
                  <div className="rp-label">Staatsangehörigkeit/Nationality</div>
                  <div className="rp-value">{v(nationality)}</div>
                </td>
              </tr>
              <tr>
                <td>
                  <div className="rp-label">Straße/Street</div>
                  <div className="rp-value">{v(street)}</div>
                </td>
                <td>
                  <div className="rp-label">PLZ/Postcode</div>
                  <div className="rp-value">{v(postcode)}</div>
                </td>
              </tr>
              <tr>
                <td>
                  <div className="rp-label">Ort/City</div>
                  <div className="rp-value">{v(city)}</div>
                </td>
                <td>
                  <div className="rp-label">Land/Country</div>
                  <div className="rp-value">{v(country)}</div>
                </td>
              </tr>
              <tr>
                <td>
                  <div className="rp-label">Kfz-Kennzeichen/License plate</div>
                  <div className="rp-value">{v(plate)}</div>
                </td>
                <td>
                  <div className="rp-label">Ausweisnummer/ID no.</div>
                  <div className="rp-value">{v(idNo)}</div>
                </td>
              </tr>
              <tr>
                <td>
                  <div className="rp-label">Handynummer/Phone number</div>
                  <div className="rp-value">{v(phone)}</div>
                </td>
                <td>
                  <div className="rp-label">E-Mailadresse/E-Mail</div>
                  <div className="rp-value">{v(email)}</div>
                </td>
              </tr>
              <tr>
                <td className="rp-people">
                  <div className="rp-label">Anzahl Personen/No of people</div>
                  <div className="rp-line">Erwachsene ab 12 Jahre/adults from 12 years: {v(adults)}</div>
                  <div className="rp-line">Kinder/children: {v(children)}</div>
                  <div className="rp-line">Kleinkinder/infants: {v(infants)}</div>
                </td>
                <td className="rp-people">
                  <div className="rp-label">Anzahl Haustiere/No of pets</div>
                  <div className="rp-line">Hunde/dogs: {v(dogs)}</div>
                  <div className="rp-line">Andere/others: {v(petsOther)}</div>
                </td>
              </tr>
              <tr>
                <td className="rp-sign">
                  <div className="rp-label">Unterschrift/Signature</div>
                  <div className="rp-sign-line" />
                </td>
                <td className="rp-sign">
                  <div className="rp-label">Zahlung: {v(payment)}</div>
                  <div className="rp-pay">EC &nbsp;&nbsp;&nbsp;&nbsp; Bar</div>
                </td>
              </tr>
            </tbody>
          </table>

          <div className="rp-footer">
            <p>
              Mit Ihrer Unterschrift akzeptieren Sie unsere Datenschutzklausel sowie unsere Geschäftsbedingungen.
              Gemäß BMG § 29, Abs. 2–3 sind wir verpflichtet, Ihre persönlichen Daten bei Anreise aufzunehmen
              und den ausgefüllten Meldeschein am Tag der Abreise für ein Jahr aufzubewahren. Nach Ablauf wird
              der Meldeschein vernichtet.
            </p>
            <p>
              With your signature, you accept our privacy clause and terms. According to BMG § 29, Abs. 2–3, we are
              obliged to record your personal data upon arrival and keep the completed registration form for one year
              from the day of departure. After this period, the form is destroyed.
            </p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .registration-print-root {
          display: none;
        }
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            width: 210mm;
            height: 297mm;
            background: white;
            overflow: hidden !important;
          }
          body * {
            visibility: hidden !important;
          }
          #registration-print-area,
          #registration-print-area * {
            visibility: visible !important;
          }
          #registration-print-area {
            display: block !important;
            position: fixed;
            left: 0;
            top: 0;
            width: 210mm;
            min-height: 297mm;
            background: #fff;
            padding: 10mm;
            box-sizing: border-box;
            overflow: hidden !important;
          }
          .registration-print-sheet {
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            color: #111;
            font-size: 11px;
            overflow: hidden !important;
          }
        }
        .rp-header {
          text-align: left;
          margin-bottom: 8px;
        }
        .rp-logo-row {
          display: flex;
          align-items: center;
          gap: 10px;
          justify-content: center;
        }
        .rp-logo {
          width: 52px;
          height: 52px;
          border-radius: 999px;
          background: radial-gradient(circle at 18px 15px, #f1b348 0 8px, transparent 8px),
            linear-gradient(180deg, #d47c4e 0 20%, #cf9a57 20% 38%, #7e9b66 38% 57%, #4f7d76 57% 100%);
          border: 1px solid #b4b4b4;
        }
        .rp-brand {
          font-size: 32px;
          font-weight: 700;
          color: #a45a35;
          line-height: 1.05;
          letter-spacing: 0.2px;
        }
        .rp-country {
          font-size: 21px;
          color: #a45a35;
          font-weight: 700;
          margin-top: 1px;
        }
        .rp-address {
          margin-top: 6px;
          font-size: 12px;
          text-align: center;
        }
        .rp-title {
          margin-top: 8px;
          font-size: 34px;
          line-height: 1.1;
          font-weight: 700;
          color: #a45a35;
          text-align: center;
        }
        .rp-main-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        .rp-main-table td {
          border: 1px solid #666;
          vertical-align: top;
          padding: 7px 8px;
          min-height: 28px;
          background: #fff;
        }
        .rp-main-table .rp-wide {
          min-height: 36px;
        }
        .rp-label-large {
          font-weight: 700;
          font-size: 13px;
        }
        .rp-label {
          font-size: 10.5px;
          color: #333;
          margin-bottom: 4px;
        }
        .rp-value {
          min-height: 16px;
          font-size: 12.5px;
          font-weight: 600;
        }
        .rp-people {
          min-height: 85px;
        }
        .rp-line {
          margin: 6px 0;
        }
        .rp-sign {
          min-height: 72px;
        }
        .rp-sign-line {
          margin-top: 26px;
          border-top: 1px dashed #444;
          height: 1px;
        }
        .rp-pay {
          margin-top: 20px;
        }
        .rp-footer {
          margin-top: 8px;
          border: 1px solid #666;
          padding: 6px 8px;
          font-size: 8.7px;
          line-height: 1.35;
          background: #fafafa;
        }
        .rp-footer p {
          margin: 0 0 5px 0;
        }
        .rp-footer p:last-child {
          margin-bottom: 0;
        }
      `}</style>
    </>
  );
}
