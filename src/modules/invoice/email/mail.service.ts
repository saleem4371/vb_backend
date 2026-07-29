import nodemailer from 'nodemailer';
import { generatePdfBuffer } from '../pdf/pdf.generator';
import { invoiceTemplate } from "./templates/invoice.template";

//Enquire
import { enquiryTemplate } from "./templates/enquiry.template";


export async function sendInvoiceEmail(data: any) {

    const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const pdf = await generatePdfBuffer(data);

  await transporter.sendMail({

    from: 'Invoice System <no-reply@system.com>',

    to: data.email,

    subject: `Invoice - ${data.refNo}`,

    text: `Invoice ${data.refNo}`,

    html: invoiceTemplate(data),

    attachments: [
      {
        filename: `Invoice-${data.refNo}.pdf`,
        content: pdf,
        contentType: "application/pdf",
      },
    ],

  });
}


export async function sentEnquireEmail(data:any)
{
   const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

await transporter.sendMail({
  from: `"venuebook.in" <no-reply@system.com>`,
  to: data.email,
  subject: `Enquiry Received - ${data.enquiryId}`,
  html: enquiryTemplate({
    customerName: data.customerName,
    venueName: data.venueName,
    enquiryId: data.enquiryId,
    enquiryDate: data.enquiryDate,
    eventDate: data.eventDate,
    eventType: data.eventType,
    guests: data.guests,
    message: data.message,
  }),
});
}
