import {
  Controller,
  Get,
  UseGuards,
  Put,
  Req,
  Post,
  Body,
  Query,
  Res,
  Headers,
} from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';

import { JwtAuthGuard } from '../../../modules/auth/strategies/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/user.decorator';

import { SurepassService } from './surepass.service';

@Controller('thirdParty')
export class SurepassController {
  constructor(private readonly surepassService: SurepassService) {}

  @UseGuards(JwtAuthGuard)
  @Post('verifyPAN')
  pan_verify(
    @Body() body: any,
    @CurrentUser() user: any,
    @Headers('x-category') category: string,
    @Headers('x-country') country: string,
  ) {
    return this.surepassService.verifyPan(body, user?.id, category, country);
  }

  @UseGuards(JwtAuthGuard)
  @Post('verifyGST')
  verifyGST(@Body() body: any, @CurrentUser() user: any) {
    return this.surepassService.verifyGST(body, user?.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('verifyBank')
  verifyBank(
    @Body() body: any,
    @CurrentUser() user: any,
    @Headers('x-category') category: string,
    @Headers('x-country') country: string,
  ) {
    return this.surepassService.verifyBank(body, user?.id, category, country);
  }

  /* ─────────────────────────────────────────────────────────────
     DigiLocker / Aadhaar init.

     FIX: previously this called
       surepassService.verifyAdhar(body, user?.id, categoryId, countryId)
     against a service signature of
       verifyAdhar(body, userId, countryId, categoryId)
     — the last two args were swapped, so every Aadhaar KYC row ended
     up with category_id/country_id transposed after the round trip
     through DigiLocker's `state` param. Passing a single context
     object instead of positional args removes this whole class of
     bug (nothing to accidentally reorder anymore).

     Both routes below are kept for backward compatibility with
     whatever the frontend currently calls, but both now go through
     the one correctly-implemented service method.
  ───────────────────────────────────────────────────────────────── */
  @UseGuards(JwtAuthGuard)
  @Post('verifyAdhar')
  initAadhaarV1(
    @Body() body: any,
    @CurrentUser() user: any,
    @Headers('x-category') categoryId: string,
    @Headers('x-country') countryId: string,
  ) {
    return this.surepassService.initializeDigilocker(body, {
      userId: user?.id,
      categoryId: Number(categoryId),
      countryId: Number(countryId),
    });
  }

  /* FIX: was @Get() with an @Body() param — GET requests can't
     reliably carry a body (many HTTP clients/proxies strip it), which
     is almost certainly why this route silently misbehaved. Converted
     to POST to match the other verify* endpoints. If the frontend
     currently calls this with GET, update it to POST as well. */
  @UseGuards(JwtAuthGuard)
  @Post('initializeDigilocker')
  initializeDigilocker(
    @Body() body: any,
    @CurrentUser() user: any,
    @Headers('x-category') categoryId: string,
    @Headers('x-country') countryId: string,
  ) {
    return this.surepassService.initializeDigilocker(body, {
      userId: user?.id,
      categoryId: Number(categoryId),
      countryId: Number(countryId),
    });
  }

  @Get('digilocker/callback')
  async callback(@Query() query: any, @Res() reply: FastifyReply) {
    try {
      console.log('===== DigiLocker Controller Callback =====');
      console.log(JSON.stringify(query, null, 2));

      const result = await this.surepassService.handleCallback(query);

      console.log('===== DigiLocker Result =====');
      console.log(JSON.stringify(result, null, 2));

      if (!result.success) {
        return reply
          .status(400)
          .type('text/html')
          .send(this.renderFailurePage(result.message));
      }

      return reply
        .status(200)
        .type('text/html')
        .send(this.renderSuccessPage(result));
    } catch (error: any) {
      console.error('===== DigiLocker Controller Error =====');
      console.error(error);

      return reply
        .status(500)
        .type('text/html')
        .send(this.renderFailurePage(error?.message || 'Something went wrong'));
    }
  }

  /* FIX: this route did not exist at all, even though
     initializeDigilocker() sends Surepass a webhook_url pointing here.
     Every webhook call from Surepass was 404ing silently. No guard —
     this is a server-to-server callback, not an authenticated user
     request (consider verifying a Surepass signature header here if
     one is available in your plan). */
  @Post('digilocker/webhook')
  async webhook(@Body() body: any) {
    return this.surepassService.handleWebhook(body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('UploadDocument')
  async UploadDocument(@Req() req: FastifyRequest, @CurrentUser() user: any) {
    try {
      const parts = req.parts();

      const body: any = {};
      let document: any = null;

      for await (const part of parts) {
        if (part.type === 'file') {
          if (!part.filename) continue;

          const buffer = await part.toBuffer();
          if (!buffer || buffer.length === 0) continue;

          const fileData = {
            buffer,
            filename: part.filename,
            mimetype: part.mimetype,
          };

          if (part.fieldname === 'file') {
            document = fileData;
          }
        }

        if (part.type === 'field') {
          body[part.fieldname] = String(part.value);
        }
      }

      return await this.surepassService.UploadDocument(document, body, user?.id);
    } catch (error) {
      // FIX: previously this caught the error, logged it, and returned
      // nothing — the client would get an empty 200 response and have
      // no idea the upload actually failed. Re-throw so NestJS sends a
      // proper error response instead.
      console.error(error);
      throw error;
    }
  }

  private escapeHtml(value: string): string {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private renderSuccessPage(result: any): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Verification Complete</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; font-family:Arial,sans-serif; }
body { height:100vh; display:flex; justify-content:center; align-items:center;
  background:linear-gradient(135deg,#0f172a,#1e293b); color:#fff; }
.card { width:420px; max-width:90%; padding:40px; text-align:center; border-radius:20px;
  background:rgba(255,255,255,.08); backdrop-filter:blur(20px); box-shadow:0 20px 50px rgba(0,0,0,.4); }
.success { width:90px; height:90px; margin:auto; border-radius:50%; background:#22c55e;
  display:flex; align-items:center; justify-content:center; font-size:40px; animation:pop .6s ease; }
h2 { margin-top:20px; }
p { margin-top:10px; color:#d1d5db; line-height:1.6; }
.loader { margin:25px auto 0; width:40px; height:40px; border:4px solid rgba(255,255,255,.2);
  border-top:4px solid #22c55e; border-radius:50%; animation:spin 1s linear infinite; }
@keyframes spin { 100% { transform:rotate(360deg); } }
@keyframes pop { 0% { transform:scale(.2); opacity:0; } 100% { transform:scale(1); opacity:1; } }
</style>
</head>
<body>
  <div class="card">
    <div class="success">✓</div>
    <h2>Verification Successful</h2>
    <p>Your DigiLocker verification has been completed successfully.</p>
    <p>This window will close automatically.</p>
    <div class="loader"></div>
  </div>
  <script>
    const payload = ${JSON.stringify(result)};
    if (window.opener) {
      window.opener.postMessage({ type: "DIGILOCKER_SUCCESS", data: payload }, "*");
    }
    setTimeout(() => { window.close(); }, 2500);
  </script>
</body>
</html>`;
  }

  private renderFailurePage(message?: string): string {
    // FIX: previously posted type "DIGILOCKER_FAILED", but the
    // frontend's message listener checks for "DIGILOCKER_FAILURE" —
    // the mismatch meant a failed attempt never reached the UI at all,
    // it just silently sat on the "awaiting" screen forever. Also
    // previously never called window.close(), leaving the failed tab
    // open indefinitely.
    return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Verification Failed</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; font-family:Arial,sans-serif; }
body { height:100vh; display:flex; justify-content:center; align-items:center; background:#0f172a; color:#fff; }
.card { width:420px; max-width:90%; padding:40px; text-align:center; border-radius:20px;
  background:rgba(255,255,255,.08); box-shadow:0 20px 50px rgba(0,0,0,.4); }
.error { width:90px; height:90px; margin:auto; border-radius:50%; background:#ef4444;
  display:flex; align-items:center; justify-content:center; font-size:40px; }
h2 { margin-top:20px; }
p { margin-top:10px; color:#d1d5db; line-height:1.6; }
</style>
</head>
<body>
  <div class="card">
    <div class="error">✕</div>
    <h2>Verification Failed</h2>
    <p>${this.escapeHtml(message || 'DigiLocker verification failed')}</p>
  </div>
  <script>
    const payload = ${JSON.stringify({ success: false, message: message || 'DigiLocker verification failed' })};
    if (window.opener) {
      window.opener.postMessage({ type: "DIGILOCKER_FAILURE", data: payload }, "*");
    }
    setTimeout(() => { window.close(); }, 2500);
  </script>
</body>
</html>`;
  }
}
