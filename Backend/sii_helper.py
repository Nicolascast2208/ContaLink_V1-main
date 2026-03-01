import requests
import base64
import ssl
import json
from lxml import html
from rut_chile import rut_chile
from requests.adapters import HTTPAdapter
from urllib3.poolmanager import PoolManager
from urllib3.util.ssl_ import create_urllib3_context

# --- 1. ADAPTADOR SSL (Para arreglar el error BAD_SIGNATURE) ---
class LegacySSLAdapter(HTTPAdapter):
    def init_poolmanager(self, connections, maxsize, block=False):
        context = create_urllib3_context()
        # Forzamos seguridad nivel 0 para aceptar el certificado antiguo del SII
        context.set_ciphers('DEFAULT:@SECLEVEL=0') 
        context.options |= 0x4  # OP_LEGACY_SERVER_CONNECT
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
        self.poolmanager = PoolManager(
            num_pools=connections,
            maxsize=maxsize,
            block=block,
            ssl_context=context
        )

# --- 2. CLASE CONSULTA (Basada en tu repositorio subido) ---
class Consulta:
    XPATH_RAZON_SOCIAL = '/html/body/div/div[4]'
    XPATH_ACTIVIDADES = '/html/body/div/table[1]/tr'

    def __init__(self, rut):
        self.rut = rut
        # Inicializamos una sesión persistente con el adaptador SSL
        self.session = requests.Session()
        self.session.mount('https://', LegacySSLAdapter())

    def fetch_captcha(self):
        try:
            # Usamos self.session para mantener la configuración SSL
            response = self.session.post('https://zeus.sii.cl/cvc_cgi/stc/CViewCaptcha.cgi', data={'oper': 0})
            data = response.json()
            return {
                'code': base64.b64decode(data['txtCaptcha'])[36:40].decode(),
                'captcha': data['txtCaptcha']
            }
        except Exception as e:
            print(f"⚠️ Error Captcha: {e}")
            return None

    def obtener_datos(self):
        # 1. Validar RUT
        if not rut_chile.is_valid_rut(self.rut):
            return None

        # 2. Formatear RUT
        rut_formatted = rut_chile.format_capitalized_rut_without_dots(self.rut)
        rut_body = rut_formatted.split('-')[0]
        dv = rut_formatted.split('-')[1]

        # 3. Obtener Captcha
        captcha = self.fetch_captcha()
        if not captcha:
            return None

        # 4. Consultar Datos
        payload = {
            'RUT': rut_body,
            'DV':  dv,
            'PRG': 'STC',
            'OPC': 'NOR',
            'txt_code': captcha['code'],
            'txt_captcha': captcha['captcha']
        }

        try:
            response = self.session.post('https://zeus.sii.cl/cvc_cgi/stc/getstc', data=payload)
            tree = html.fromstring(response.text)

            # --- Extracción usando los XPaths del repositorio ---
            try:
                razon_social = tree.xpath(self.XPATH_RAZON_SOCIAL)[0].text.strip()
            except:
                razon_social = "Desconocido"

            # Extraer actividades (Giros)
            actividades = []
            # Saltamos la primera fila (encabezado) como hace el repo [1:]
            filas = tree.xpath(self.XPATH_ACTIVIDADES)[1:]
            
            for fila in filas:
                try:
                    # El giro está en la primera columna (td[1])
                    giro_texto = fila.xpath('./td[1]/font')[0].text.strip()
                    actividades.append(giro_texto)
                except:
                    continue

            # Seleccionamos el primer giro como principal
            giro_principal = actividades[0] if actividades else "Sin Giro Detectado"

            return {
                "razon_social": razon_social,
                "giro": giro_principal,
                "rut_formateado": rut_formatted
            }

        except Exception as e:
            print(f"⚠️ Error procesando respuesta SII: {e}")
            return None

def consultar_rut_sii(rut):
    print(f"🔎 Consultando SII para RUT: {rut}...")
    consulta = Consulta(rut)
    return consulta.obtener_datos()