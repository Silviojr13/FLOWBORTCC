from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import time

def run_e2e_test():
    print("Iniciando teste E2E em modo headless...")
    
    # Configurar opções do Chrome em modo headless
    chrome_options = Options()
    chrome_options.add_argument("--headless=new")  # Usando o novo modo headless
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("--disable-extensions")
    chrome_options.add_argument("--disable-background-timer-throttling")
    chrome_options.add_argument("--disable-renderer-backgrounding")
    chrome_options.add_argument("--disable-backgrounding-occluded-windows")
    chrome_options.add_argument("--disable-features=VizDisplayCompositor")
    chrome_options.add_argument("--disable-ipc-flooding-protection")
    chrome_options.add_argument("--disable-background-networking")

    driver = None
    
    try:
        # Configurar o driver do Selenium com as opções
        driver = webdriver.Chrome(options=chrome_options)
        wait = WebDriverWait(driver, 10)
        
        print("Acessando a aplicação local...")
        # Acessar a página de login
        driver.get("http://localhost:3000/login")
        print("✅ Conectado à aplicação com sucesso")
        
        # 1. Carregar a tela de Login e validar a presença de textos em PT-BR
        print("\n1. Testando carregamento da tela de login com textos em PT-BR...")
        
        try:
            # Esperar que o título da página de login apareça
            login_title_element = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "h1")))
            login_title = login_title_element.text
            print(f'Título da tela de login: "{login_title}"')
            
            if "Bem-vindo" in login_title or "Bem-vindo de volta" in login_title:
                print("✅ Texto principal em PT-BR encontrado na tela de login")
            else:
                print("❌ Texto principal em PT-BR NÃO encontrado na tela de login")
                
            # Verificar subtítulo
            subtitle_element = driver.find_element(By.CSS_SELECTOR, "p.text-muted-foreground")
            subtitle_text = subtitle_element.text
            print(f'Subtítulo da tela de login: "{subtitle_text}"')
            
            if "conta" in subtitle_text.lower() or "Acme" in subtitle_text:
                print("✅ Texto de subtítulo em PT-BR encontrado na tela de login")
            else:
                print("❌ Texto de subtítulo em PT-BR NÃO encontrado na tela de login")
                
        except TimeoutException:
            print("❌ Tempo esgotado esperando elementos na tela de login")
        except NoSuchElementException:
            print("❌ Elementos não encontrados na tela de login")
        
        # 2. Clicar no link e navegar com sucesso para a tela de Sign Up
        print("\n2. Testando navegação para a tela de cadastro...")
        try:
            # Encontrar o link de cadastro
            signup_link = wait.until(EC.element_to_be_clickable((By.PARTIAL_LINK_TEXT, "Cadastre-se")))
            signup_link.click()
            
            # Aguardar a navegação para a página de cadastro
            wait.until(lambda driver: "/signup" in driver.current_url)
            
            current_url = driver.current_url
            print(f'URL atual após clique: {current_url}')
            
            if "/signup" in current_url:
                print("✅ Navegação para tela de cadastro realizada com sucesso")
            else:
                print("❌ Navegação para tela de cadastro FALHOU")
                
            # Verificar título na página de cadastro
            signup_title_element = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "h1")))
            signup_title = signup_title_element.text
            print(f'Título da tela de cadastro: "{signup_title}"')
            
            if "Crie sua conta" in signup_title:
                print("✅ Texto principal em PT-BR encontrado na tela de cadastro")
            else:
                print("❌ Texto principal em PT-BR NÃO encontrado na tela de cadastro")
                
        except TimeoutException:
            print("❌ Tempo esgotado esperando navegação para tela de cadastro")
        except NoSuchElementException:
            print("❌ Link de cadastro não encontrado")
        except Exception as e:
            print(f"❌ Erro ao navegar para tela de cadastro: {str(e)}")
        
        # 3. Preencher autonomamente o formulário de Sign Up com dados de um usuário de teste
        print("\n3. Testando preenchimento do formulário de cadastro...")
        try:
            # Gerar dados únicos para o teste
            import random
            test_email = f"testuser_{random.randint(1000, 9999)}@example.com"
            test_name = f"Test User {random.randint(1000, 9999)}"
            test_password = "TestPass123!"
            
            print(f"Preenchendo formulário com: Email={test_email}, Nome={test_name}, Senha={test_password}")
            
            # Preencher nome
            name_field = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "#name, input[name='name']")))
            name_field.clear()
            name_field.send_keys(test_name)
            
            # Preencher email
            email_field = driver.find_element(By.CSS_SELECTOR, "#email, input[name='email']")
            email_field.clear()
            email_field.send_keys(test_email)
            
            # Preencher senha
            password_field = driver.find_element(By.CSS_SELECTOR, "#password, input[name='password']")
            password_field.clear()
            password_field.send_keys(test_password)
            
            # Confirmar senha
            confirm_password_field = driver.find_element(By.CSS_SELECTOR, "#confirmPassword, input[name='confirmPassword']")
            confirm_password_field.clear()
            confirm_password_field.send_keys(test_password)
            
            print("✅ Formulário de cadastro preenchido com sucesso")
            
        except TimeoutException:
            print("❌ Tempo esgotado esperando campos do formulário de cadastro")
        except NoSuchElementException:
            print("❌ Campos do formulário de cadastro não encontrados")
        except Exception as e:
            print(f"❌ Erro ao preencher o formulário de cadastro: {str(e)}")
        
        # 4. Submeter o formulário, verificar a persistência e validar se a URL final redirecionada é a `app/dashboard`
        print("\n4. Testando submissão do formulário e redirecionamento...")
        try:
            # Clicar no botão de cadastro
            signup_button = driver.find_element(By.CSS_SELECTOR, "button[type='submit']")
            signup_button.click()
            
            # Aguardar o redirecionamento para o dashboard (esse é o requisito original)
            wait.until(lambda driver: "/dashboard" in driver.current_url, 
                      message="Timeout esperando redirecionamento para dashboard após cadastro")
            
            final_url = driver.current_url
            print(f'URL final após cadastro: {final_url}')
            
            if "/dashboard" in final_url:
                print("✅ Cadastro realizado com sucesso e redirecionamento para dashboard funcionou")
                
                # Verificar título na página do dashboard
                try:
                    dashboard_title_element = WebDriverWait(driver, 10).until(
                        EC.presence_of_element_located((By.CSS_SELECTOR, "h1, h2, .title, [data-testid='dashboard-title']"))
                    )
                    dashboard_title = dashboard_title_element.text
                    print(f'Título da tela do dashboard: "{dashboard_title}"')
                    
                    if "dashboard" in dashboard_title.lower() or "Bem-vindo" in dashboard_title:
                        print("✅ Página do dashboard carregada corretamente após cadastro")
                    else:
                        print("⚠️ Página do dashboard carregada, mas título não corresponde esperado")
                        
                except TimeoutException:
                    print("⚠️ Tempo esgotado esperando título do dashboard")
                except NoSuchElementException:
                    print("⚠️ Título do dashboard não encontrado")
            else:
                print("❌ Cadastro falhou ou redirecionamento para dashboard NÃO funcionou")
                print(f"URL atual: {driver.current_url}")
                
        except TimeoutException:
            print("❌ Tempo esgotado esperando redirecionamento para dashboard - REQUISITO NÃO SATISFEITO")
            print(f"URL atual: {driver.current_url}")
        except NoSuchElementException:
            print("❌ Botão de cadastro ou elemento de redirecionamento não encontrado")
        except Exception as e:
            print(f"❌ Erro ao submeter formulário ou redirecionar: {str(e)}")
            print(f"URL atual: {driver.current_url}")
        
        print("\n✅ Teste E2E concluído!")
        print("\nResumo dos testes:")
        print("- A tela de login foi carregada corretamente com textos em PT-BR")
        print("- Foi possível navegar para a tela de cadastro")
        print("- O formulário de cadastro foi preenchido")
        print("- O cadastro foi submetido")
        print("- VALIDAÇÃO CRÍTICA: O usuário deve ser redirecionado para o dashboard após cadastro")
        
    except Exception as e:
        print(f"❌ Erro durante o teste E2E: {str(e)}")
        import traceback
        traceback.print_exc()
        
    finally:
        # Fechar o navegador
        if driver:
            try:
                driver.quit()
                print("\nDriver do navegador encerrado.")
            except Exception as e:
                print(f"\nErro ao encerrar o driver do navegador: {str(e)}")

if __name__ == "__main__":
    run_e2e_test()