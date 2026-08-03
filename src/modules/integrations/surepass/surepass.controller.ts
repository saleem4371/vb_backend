import {
  Controller,
  Get,
  UseGuards,
  Param,
  Put,
  Req,
  Patch,
  Post,
  Body,
  Query,
  Delete,
  Res,
  Headers,
  Logger
} from '@nestjs/common';
import type { FastifyRequest , FastifyReply } from 'fastify';



import { JwtAuthGuard } from '../../../modules/auth/strategies/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/user.decorator';

import { SurepassService } from './surepass.service';

@Controller('thirdParty')
export class SurepassController {
  constructor(private readonly surepassService: SurepassService,
              private readonly logger = new Logger(DigilockerController.name)
             ) {}

    @UseGuards(JwtAuthGuard)
 @Post('verifyPAN')
pan_verify(@Body() body: string,@CurrentUser() user: any,@Headers('x-category') category:any , @Headers('x-country') country:any) {
  return this.surepassService.verifyPan(body, user?.id,category,country );
}
 @UseGuards(JwtAuthGuard)
 @Post('verifyGST')
verifyGST(@Body() body: string,@CurrentUser() user: any) {
  return this.surepassService.verifyGST(body,user?.id);
}  
@UseGuards(JwtAuthGuard)
 @Post('verifyBank')
verifyBank(@Body() body: string,@CurrentUser() user: any,@Headers('x-category') category:any , @Headers('x-country') country:any) {
  return this.surepassService.verifyBank(body,user?.id,category,country);
} 

@Post('verifyAdhar')
verifyAdhar(@Body() body: string) {
  return this.surepassService.verifyAdhar(body);
}
// @Post('digilocker/callback')
// callback(@Body() body: string) {
//   return this.surepassService.callback(body);
// }

// @Get('digilocker/callback')
// async callback(@Query() query, @Res() res) {
//   console.log(query); // <-- Is this getting called?

//   // Save data...

 
//   return res.redirect(
//   `https://venuebook-psi.vercel.app/vendor/kyc/success`,
// );
// }

  // @Get('digilocker/callback')
  // async callback(
  //   @Query() query: any,
  //    @Res() reply: FastifyReply,
  // ) {
  //   await this.surepassService.handleCallback(query);

  //   return reply
  //     .type('text/html')
  //     .send(`
  //       <!DOCTYPE html>
  //       <html>
  //         <head>
  //           <title>DigiLocker Success</title>
  //         </head>
  //         <body style="font-family:Arial;text-align:center;padding-top:100px">
  //           <h2> DigiLocker Verification Successful</h2>
  //           <p>You can close this window now.</p>

  //           <script>
  //             setTimeout(() => {
  //               window.close();
  //             }, 3000);
  //           </script>
  //         </body>
  //       </html>
  //     `);
  // }
   @Get('digilocker/callback')
  async callback(@Query() query: any, @Res() reply: FastifyReply) {
    try {
      const result = await this.surepassService.handleCallback(query);
      return reply.type('text/html').send(this.renderSuccess(result));
    } catch (err) {
      this.logger.error('Digilocker callback failed', err?.stack || err);
      return reply
        .type('text/html')
        .send(this.renderError(err?.message || 'Verification failed. Please try again.'));
    }
  }

  private renderSuccess(result: any): string {
    // Escape values that get interpolated into HTML/JS to avoid breaking
    // the page (and to avoid XSS if any of these fields are user-influenced).
    const esc = (v: any) =>
      String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const safeResult = {
      name: result.name ?? '',
      masked_aadhaar: result.masked_aadhaar ?? '',
      dob: result.dob ?? '',
      gender: result.gender ?? '',
      mobile: result.mobile ?? '',
      address: result.address ?? '',
    };

    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Aadhaar Verification</title>
<style>
body{
    margin:0;
    background:#f4f7fb;
    font-family:Arial,sans-serif;
}
.card{
    width:520px;
    margin:60px auto;
    background:#fff;
    border-radius:12px;
    box-shadow:0 10px 30px rgba(0,0,0,.1);
    overflow:hidden;
}
.header{
    background:#0b6efd;
    color:#fff;
    text-align:center;
    padding:25px;
}
.success{
    font-size:70px;
}
.content{
    padding:30px;
}
table{
    width:100%;
    border-collapse:collapse;
}
td{
    padding:10px;
    border-bottom:1px solid #eee;
}
td:first-child{
    font-weight:bold;
    width:170px;
}
button{
    width:100%;
    background:#0b6efd;
    color:#fff;
    border:none;
    border-radius:8px;
    padding:14px;
    margin-top:25px;
    font-size:16px;
    cursor:pointer;
}
button:hover{
    background:#0958d9;
}
#fallback{
    display:none;
    margin-top:16px;
    padding:12px;
    background:#fff8e1;
    border:1px solid #ffe58f;
    border-radius:8px;
    font-size:13px;
    color:#8a6d00;
}
</style>
</head>
<body>
<div class="card">
<div class="header">
<div class="success">✅</div>
<h2>Aadhaar Verified Successfully</h2>
</div>
<div class="content">
<table>
<tr><td>Name</td><td>${esc(safeResult.name)}</td></tr>
<tr><td>Masked Aadhaar</td><td>${esc(safeResult.masked_aadhaar)}</td></tr>
<tr><td>Date of Birth</td><td>${esc(safeResult.dob)}</td></tr>
<tr><td>Gender</td><td>${esc(safeResult.gender)}</td></tr>
<tr><td>Mobile</td><td>${esc(safeResult.mobile)}</td></tr>
<tr><td>Address</td><td>${esc(safeResult.address)}</td></tr>
</table>
<button id="continueBtn">Continue</button>
<div id="fallback">
  Verification is complete. You can close this window and return to the
  previous tab manually.
</div>
</div>
</div>
<script>
(function () {
  var result = ${JSON.stringify(safeResult)};

  function notifyOpener() {
    // window.opener can be null if:
    //  - the popup was opened with rel="noopener" / features containing "noopener"
    //  - a Cross-Origin-Opener-Policy header (e.g. from Helmet) severs the link
    //  - the parent window itself navigated away or was closed
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage({ type: 'DIGILOCKER_SUCCESS', data: result }, '*');
        window.close();
        return true;
      } catch (e) {
        console.error('postMessage to opener failed', e);
      }
    }
    return false;
  }

  document.getElementById('continueBtn').addEventListener('click', function () {
    var ok = notifyOpener();
    if (!ok) {
      document.getElementById('fallback').style.display = 'block';
    }
  });

  // Also attempt automatically in case the user closes the popup without
  // clicking Continue (e.g. via the parent's own polling/close logic,
  // this still gives the parent a chance to receive the message first).
  notifyOpener();
})();
</script>
</body>
</html>`;
  }

  private renderError(message: string): string {
    const esc = (v: string) =>
      String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Verification Failed</title>
<style>
body{margin:0;background:#f4f7fb;font-family:Arial,sans-serif;}
.card{width:480px;margin:60px auto;background:#fff;border-radius:12px;
  box-shadow:0 10px 30px rgba(0,0,0,.1);overflow:hidden;}
.header{background:#e5484d;color:#fff;text-align:center;padding:25px;}
.icon{font-size:60px;}
.content{padding:24px;text-align:center;color:#555;font-size:14px;}
button{width:100%;background:#e5484d;color:#fff;border:none;border-radius:8px;
  padding:14px;margin-top:20px;font-size:16px;cursor:pointer;}
button:hover{background:#c53d42;}
</style>
</head>
<body>
<div class="card">
  <div class="header"><div class="icon">⚠️</div><h2>Verification Failed</h2></div>
  <div class="content">
    <p>${esc(message)}</p>
    <button id="closeBtn">Close this window</button>
  </div>
</div>
<script>
(function () {
  function notifyOpener() {
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage({ type: 'DIGILOCKER_FAILURE', message: ${JSON.stringify(message)} }, '*');
      } catch (e) {
        console.error('postMessage to opener failed', e);
      }
    }
  }
  notifyOpener();
  document.getElementById('closeBtn').addEventListener('click', function () {
    window.close();
  });
})();
</script>
</body>
</html>`;
  }

@Post('digilocker/webhook')
   async webhook(@Body() body: any, @Headers('x-category') category: any, @Headers('x-country') country: any) {
    console.log('==============================');
  console.log('WEBHOOK RECEIVED');
  console.log('Headers:', category);
     console.log('Users:', country);
  console.log('Body:', JSON.stringify(body, null, 2));
  console.log('==============================');
     try {
       await this.surepassService.handleWebhook(body, category, country);
       return { success: true };
     } catch (err) {
       console.error('handleWebhook failed', err?.stack || err);
       // still return 200 so Surepass doesn't retry-storm you while you debug,
       // but log the failure so you can see it
       return { success: false };
     }
   }

@Get('initializeDigilocker')
initializeDigilocker(@Body() body: string) {
  return this.surepassService.verifyAdhar(body);
}
 @UseGuards(JwtAuthGuard)
@Post('UploadDocument')
async UploadDocument(
  @Req() req: FastifyRequest,
  @CurrentUser() user: any,
) {
  try {
    const parts = req.parts();

    const body: any = {};
    let document: any = null;

    for await (const part of parts) {
      /*
      |--------------------------------------------------------------------------
      | FILE
      |--------------------------------------------------------------------------
      */
      if (part.type === 'file') {
        if (!part.filename) {
          continue;
        }

        const buffer = await part.toBuffer();

        if (!buffer || buffer.length === 0) {
          continue;
        }

        const fileData = {
          buffer,
          filename: part.filename,
          mimetype: part.mimetype,
        };

        if (part.fieldname === 'file') {
          document = fileData;
        }
      }

      /*
      |--------------------------------------------------------------------------
      | FIELDS
      |--------------------------------------------------------------------------
      */
      if (part.type === 'field') {
        body[part.fieldname] = String(part.value);
      }
    }

    return await this.surepassService.UploadDocument(
      document,
      body,
      user?.id,
    );
  } catch (error) {
    console.error(error);

  }
}
}
