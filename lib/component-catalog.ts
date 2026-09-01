/** Catálogo de referência frontend — valores são estimativas, não preços reais de loja. */

export const COMPONENT_CATEGORIES = [
  "Sensor",
  "Atuador",
  "Controlador",
  "Alimentação",
  "Conectividade",
  "Estrutura",
  "Outro",
] as const

export type ComponentCategory = (typeof COMPONENT_CATEGORIES)[number]

export interface CatalogComponent {
  id: string
  name: string
  category: ComponentCategory
  description: string
  referenceMinPrice: number
  referenceMaxPrice: number
}

export const COMPONENT_CATALOG: CatalogComponent[] = [
  {
    id: "cat-dht22",
    name: "Sensor DHT22",
    category: "Sensor",
    description: "Sensor de temperatura e umidade para monitoramento ambiental.",
    referenceMinPrice: 25,
    referenceMaxPrice: 45,
  },
  {
    id: "cat-hc-sr04",
    name: "Sensor ultrassônico HC-SR04",
    category: "Sensor",
    description: "Medição de distância por ultrassom, comum em robótica móvel.",
    referenceMinPrice: 12,
    referenceMaxPrice: 25,
  },
  {
    id: "cat-mpu6050",
    name: "IMU MPU6050",
    category: "Sensor",
    description: "Acelerômetro e giroscópio para orientação e estabilização.",
    referenceMinPrice: 15,
    referenceMaxPrice: 35,
  },
  {
    id: "cat-servo-sg90",
    name: "Servo motor SG90",
    category: "Atuador",
    description: "Servo pequeno para movimentos precisos em mecanismos leves.",
    referenceMinPrice: 18,
    referenceMaxPrice: 35,
  },
  {
    id: "cat-dc-motor",
    name: "Motor DC com caixa redução",
    category: "Atuador",
    description: "Motor com redução para tração e movimentação de bases.",
    referenceMinPrice: 30,
    referenceMaxPrice: 80,
  },
  {
    id: "cat-esp32",
    name: "ESP32 DevKit",
    category: "Controlador",
    description: "Microcontrolador com Wi-Fi e Bluetooth integrados.",
    referenceMinPrice: 35,
    referenceMaxPrice: 70,
  },
  {
    id: "cat-arduino-uno",
    name: "Arduino Uno R3",
    category: "Controlador",
    description: "Placa de prototipagem amplamente usada em projetos embarcados.",
    referenceMinPrice: 45,
    referenceMaxPrice: 90,
  },
  {
    id: "cat-raspberry-pi",
    name: "Raspberry Pi 4",
    category: "Controlador",
    description: "Computador de placa única para processamento e conectividade.",
    referenceMinPrice: 350,
    referenceMaxPrice: 550,
  },
  {
    id: "cat-battery-li",
    name: "Bateria LiPo 3.7V",
    category: "Alimentação",
    description: "Fonte portátil recarregável para dispositivos móveis.",
    referenceMinPrice: 40,
    referenceMaxPrice: 120,
  },
  {
    id: "cat-buck-converter",
    name: "Conversor buck LM2596",
    category: "Alimentação",
    description: "Regula tensão de entrada para alimentar sensores e controladores.",
    referenceMinPrice: 8,
    referenceMaxPrice: 20,
  },
  {
    id: "cat-wifi-module",
    name: "Módulo Wi-Fi ESP-01",
    category: "Conectividade",
    description: "Conectividade sem fio para envio de dados e telemetria.",
    referenceMinPrice: 15,
    referenceMaxPrice: 30,
  },
  {
    id: "cat-bluetooth-hc05",
    name: "Módulo Bluetooth HC-05",
    category: "Conectividade",
    description: "Comunicação serial sem fio para controle e configuração.",
    referenceMinPrice: 20,
    referenceMaxPrice: 40,
  },
  {
    id: "cat-chassis",
    name: "Chassi robótico 2 rodas",
    category: "Estrutura",
    description: "Base mecânica com suporte para motores e sensores.",
    referenceMinPrice: 50,
    referenceMaxPrice: 120,
  },
  {
    id: "cat-protoboard",
    name: "Protoboard 830 furos",
    category: "Estrutura",
    description: "Base para montagem e testes de circuitos sem solda.",
    referenceMinPrice: 10,
    referenceMaxPrice: 25,
  },
  {
    id: "cat-relay",
    name: "Módulo relé 5V",
    category: "Outro",
    description: "Chaveamento de cargas maiores a partir de sinais de baixa tensão.",
    referenceMinPrice: 8,
    referenceMaxPrice: 18,
  },
]
