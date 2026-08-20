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
  Headers
} from '@nestjs/common';
import type { FastifyRequest , FastifyReply } from 'fastify';


import { JwtAuthGuard } from '../../../modules/auth/strategies/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/user.decorator';

import { SurepassService } from './surepass.service';

@Controller('thirdParty')
export class SurepassController {
  constructor(private readonly surepassService: SurepassService) {}

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
  
@UseGuards(JwtAuthGuard)
@Post('verifyAdhar')
verifyAdhar(@Body() body: string,@CurrentUser() user: any,@Headers('x-category') categoryId:any , @Headers('x-country') countryId:any) {
  return this.surepassService.verifyAdhar(body,user?.id,categoryId,countryId);
}
// @Post('digilocker/callback') body: any,
 
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
//   @Res() reply: FastifyReply,
// ) {
//   try {
//     // Process DigiLocker callback
//     const result = await this.surepassService.handleCallback(query);

//     return reply.type('text/html').send(`
// <!DOCTYPE html>
// <html lang="en">
// <head>
// <meta charset="UTF-8">
// <meta name="viewport" content="width=device-width, initial-scale=1.0">
// <title>Verification Complete</title>

// <style>
// *{
// margin:0;
// padding:0;
// box-sizing:border-box;
// font-family:Inter,Arial,sans-serif;
// }

// body{
// height:100vh;
// display:flex;
// justify-content:center;
// align-items:center;
// background:linear-gradient(135deg,#0f172a,#1e293b);
// color:#fff;
// }

// .card{
// width:420px;
// max-width:90%;
// background:rgba(255,255,255,.08);
// backdrop-filter:blur(20px);
// padding:40px;
// border-radius:20px;
// text-align:center;
// box-shadow:0 20px 50px rgba(0,0,0,.4);
// }

// .success{
// width:90px;
// height:90px;
// margin:auto;
// border-radius:50%;
// background:#22c55e;
// display:flex;
// align-items:center;
// justify-content:center;
// font-size:40px;
// animation:pop .6s ease;
// }

// h2{
// margin-top:20px;
// }

// p{
// margin-top:10px;
// color:#d1d5db;
// line-height:1.6;
// }

// .loader{
// margin:25px auto 0;
// width:40px;
// height:40px;
// border:4px solid rgba(255,255,255,.2);
// border-top:4px solid #22c55e;
// border-radius:50%;
// animation:spin 1s linear infinite;
// }

// @keyframes spin{
// 100%{
// transform:rotate(360deg);
// }
// }

// @keyframes pop{
// 0%{
// transform:scale(.2);
// opacity:0;
// }
// 100%{
// transform:scale(1);
// opacity:1;
// }
// }
// </style>
// </head>

// <body>

// <div class="card">

// <div class="success">✓</div>

// <h2>Verification Successful</h2>

// <p>
// Your DigiLocker verification has been completed successfully.
// This window will close automatically.
// </p>

// <div class="loader"></div>

// </div>

// <script>

// const payload = ${JSON.stringify(result)};

// setTimeout(() => {

//     if (window.opener) {
//         window.opener.postMessage({
//             type: "DIGILOCKER_SUCCESS",
//             data: payload
//         }, "*");
//     }

    

// }, 2500);

// </script>

// </body>
// </html>
// `);

//   } catch (error) {
//     return reply.status(500).type('text/html').send(`
//       <h2>DigiLocker Verification Failed</h2>
//       <p>------------</p>
//     `);
//   }
// }

@Get('digilocker/callback')
  async callback(
    @Query() query: any,
    @Res() reply: FastifyReply,
  ) {
    try {
      console.log('===== DigiLocker Controller Callback =====');
      console.log(JSON.stringify(query, null, 2));

      const result =
        await this.surepassService.handleCallback(query);

      console.log('===== DigiLocker Result =====');
      console.log(JSON.stringify(result, null, 2));

      // -----------------------------------------
      // Verification failed
      // -----------------------------------------
      if (!result.success) {
        return reply
          .status(400)
          .type('text/html')
          .send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta
                name="viewport"
                content="width=device-width, initial-scale=1.0"
              >
              <title>Verification Failed</title>

              <style>
                * {
                  margin: 0;
                  padding: 0;
                  box-sizing: border-box;
                  font-family: Arial, sans-serif;
                }

                body {
                  height: 100vh;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  background: #0f172a;
                  color: #fff;
                }

                .card {
                  width: 420px;
                  max-width: 90%;
                  padding: 40px;
                  text-align: center;
                  border-radius: 20px;
                  background: rgba(255,255,255,.08);
                  box-shadow: 0 20px 50px rgba(0,0,0,.4);
                }

                .error {
                  width: 90px;
                  height: 90px;
                  margin: auto;
                  border-radius: 50%;
                  background: #ef4444;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 40px;
                }

                h2 {
                  margin-top: 20px;
                }

                p {
                  margin-top: 10px;
                  color: #d1d5db;
                  line-height: 1.6;
                }
              </style>
            </head>

            <body>
              <div class="card">
                <div class="error">✕</div>

                <h2>Verification Failed</h2>

                <p>
                  ${this.escapeHtml(
                    result.message ||
                      'DigiLocker verification failed',
                  )}
                </p>
              </div>

              <script>
                const payload = ${JSON.stringify(result)};

                if (window.opener) {
                  window.opener.postMessage(
                    {
                      type: "DIGILOCKER_FAILED",
                      data: payload
                    },
                    "*"
                  );
                }
              </script>
            </body>
            </html>
          `);
      }

      // -----------------------------------------
      // Verification successful
      // -----------------------------------------
      return reply
        .status(200)
        .type('text/html')
        .send(`
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta
              name="viewport"
              content="width=device-width, initial-scale=1.0"
            >

            <title>Verification Complete</title>

            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
                font-family: Arial, sans-serif;
              }

              body {
                height: 100vh;
                display: flex;
                justify-content: center;
                align-items: center;
                background:
                  linear-gradient(
                    135deg,
                    #0f172a,
                    #1e293b
                  );
                color: #fff;
              }

              .card {
                width: 420px;
                max-width: 90%;
                padding: 40px;
                text-align: center;
                border-radius: 20px;

                background:
                  rgba(255,255,255,.08);

                backdrop-filter: blur(20px);

                box-shadow:
                  0 20px 50px rgba(0,0,0,.4);
              }

              .success {
                width: 90px;
                height: 90px;
                margin: auto;
                border-radius: 50%;
                background: #22c55e;

                display: flex;
                align-items: center;
                justify-content: center;

                font-size: 40px;

                animation: pop .6s ease;
              }

              h2 {
                margin-top: 20px;
              }

              p {
                margin-top: 10px;
                color: #d1d5db;
                line-height: 1.6;
              }

              .loader {
                margin: 25px auto 0;
                width: 40px;
                height: 40px;

                border: 4px solid
                  rgba(255,255,255,.2);

                border-top: 4px solid #22c55e;

                border-radius: 50%;

                animation:
                  spin 1s linear infinite;
              }

              @keyframes spin {
                100% {
                  transform: rotate(360deg);
                }
              }

              @keyframes pop {
                0% {
                  transform: scale(.2);
                  opacity: 0;
                }

                100% {
                  transform: scale(1);
                  opacity: 1;
                }
              }
            </style>
          </head>

          <body>

            <div class="card">

              <div class="success">✓</div>

              <h2>
                Verification Successful
              </h2>

              <p>
                Your DigiLocker verification has been
                completed successfully.
              </p>

              <p>
                This window will close automatically.
              </p>

              <div class="loader"></div>

            </div>

            <script>

              const payload =
                ${JSON.stringify(result)};

              if (window.opener) {

                window.opener.postMessage(
                  {
                    type: "DIGILOCKER_SUCCESS",
                    data: payload
                  },
                  "*"
                );

              }

              setTimeout(() => {

                window.close();

              }, 2500);

            </script>

          </body>
          </html>
        `);

    } catch (error: any) {
      console.error(
        '===== DigiLocker Controller Error =====',
      );

      console.error(error);

      return reply
        .status(500)
        .type('text/html')
        .send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Verification Failed</title>
          </head>

          <body>
            <h2>DigiLocker Verification Failed</h2>

            <p>
              ${
                this.escapeHtml(
                  error?.message ||
                    'Something went wrong',
                )
              }
            </p>
          </body>
          </html>
        `);
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
  
 @UseGuards(JwtAuthGuard)
@Get('initializeDigilocker')
initializeDigilocker(@Body() body: string,@CurrentUser() user: any,@Headers('x-category') categoryId:any , @Headers('x-country') countryId:any) {
  return this.surepassService.verifyAdhar(body, user?.id,categoryId,countryId);
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
