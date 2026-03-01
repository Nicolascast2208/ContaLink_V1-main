import requests
import base64
from lxml import html
from rut_chile import rut_chile

class Consulta:
    # XPaths extraídos de tu archivo consulta.py
    XPATH_RAZON_SOCIAL = '/html/body/div/div[4]'
    XPATH_ACTIVIDADES = '/html/body/div/table[1]/tr'

    def __init__(self, rut):
        self.rut = rut

    def fetch_captcha(self):
        """Obtiene y resuelve el captcha automáticamente usando el truco de decodificación"""
        try:
            # Petición para obtener el captcha en base64
            response = requests.post('https://zeus.sii.cl/cvc_cgi/stc/CViewCaptcha.cgi', data={'oper': 0})
            data = response.json()
            # Esta lógica extrae el código del captcha base64 en los índices 36:40
            code = base64.b64decode(data['txtCaptcha'])[36:40].decode()
            return {'code': code, 'captcha': data['txtCaptcha']}
        except Exception as e:
            print(f"❌ Error obteniendo Captcha SII: {e}")
            return None

    def obtener_datos(self):
        # 1. Validar RUT usando la librería rut-chile
        if not rut_chile.is_valid_rut(self.rut):
            return None

        # 2. Formatear RUT para la consulta (separar cuerpo y dígito verificador)
        rut_formatted = rut_chile.format_capitalized_rut_without_dots(self.rut)
        rut_cuerpo = rut_formatted.split('-')[0]
        dv  = rut_formatted.split('-')[1]

        # 3. Obtener Captcha
        captcha = self.fetch_captcha()
        if not captcha:
            return None

        # 4. Consultar al SII enviando los datos y el captcha resuelto
        payload = {
            'RUT': rut_cuerpo,
            'DV':  dv,
            'PRG': 'STC',
            'OPC': 'NOR',
            'txt_code': captcha['code'],
            'txt_captcha': captcha['captcha']
        }
        
        try:
            response = requests.post('https://zeus.sii.cl/cvc_cgi/stc/getstc', data=payload)
            # Parsear el HTML resultante
            tree = html.fromstring(response.text)

            # 5. Extraer Razón Social usando el XPath
            try:
                razon_social = tree.xpath(self.XPATH_RAZON_SOCIAL)[0].text.strip()
            except:
                razon_social = "Desconocido"

            # 6. Extraer Giros de la tabla de actividades
            giros = []
            # Saltamos la primera fila (encabezados) con [1:]
            filas_giro = tree.xpath(self.XPATH_ACTIVIDADES)[1:] 
            
            for fila in filas_giro:
                try:
                    # El giro está en la primera columna (td[1]) dentro de una etiqueta font
                    texto_giro = fila.xpath('./td[1]/font')[0].text.strip()
                    giros.append(texto_giro)
                except:
                    continue
            
            # Devolvemos el giro principal (el primero de la lista)
            giro_principal = giros[0] if giros else "Sin Giro Detectado"

            return {
                "razon_social": razon_social,
                "giro": giro_principal,
                "rut_formateado": rut_formatted
            }

        except Exception as e:
            print(f"❌ Error interpretando respuesta SII: {e}")
            return None

def consultar_rut_sii(rut):
    """Función helper para llamar desde cerebro.py"""
    print(f"🔎 Consultando SII para RUT: {rut}...")
    consulta = Consulta(rut)
    return consulta.obtener_datos()
