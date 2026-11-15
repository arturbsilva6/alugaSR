// Massa de demonstração acadêmica — nenhum destes imóveis/anunciantes existe na plataforma.
// Não incluir endereço completo, coordenadas, telefone, imagem de usuário ou dados pessoais.
export const DEMO_LISTINGS = Object.freeze([
  {
    id: "demo-001", title: "Casa térrea próxima ao centro e serviços",
    type: "casa", region: "Centro (exemplo)", regionKey: "centro",
    rent: 1850, condominium: 0, iptu: 95, feePeriod: "mensal",
    bedrooms: 3, bathrooms: 2, parking: 1, area: 92, image: "casa.svg",
    description: "Casa ilustrativa com ambientes integrados, espaço para família e fácil acesso aos serviços da região central. Todas as informações são fictícias e destinadas somente aos testes de interface.",
    features: ["Sala integrada", "Área de serviço", "Quintal ilustrativo"]
  },
  {
    id: "demo-002", title: "Apartamento bem iluminado",
    type: "apartamento", region: "São Roque/SP — região ilustrativa", regionKey: "outras",
    rent: 1650, condominium: null, iptu: 0, feePeriod: "mensal",
    bedrooms: 2, bathrooms: 1, parking: 1, area: 64, image: "apartamento.svg",
    description: "Apartamento fictício com dois dormitórios e ambientes claros. O valor de condomínio não foi informado, portanto o total mensal não pode ser calculado.",
    features: ["Boa ventilação", "Cozinha compacta", "Vaga ilustrativa"]
  },
  {
    id: "demo-003", title: "Sobrado com área externa",
    type: "sobrado", region: "São Roque/SP — região ilustrativa", regionKey: "outras",
    rent: 2850, condominium: 0, iptu: 170, feePeriod: "mensal",
    bedrooms: 3, bathrooms: 2, parking: 2, area: 130, image: "sobrado.svg",
    description: "Sobrado demonstrativo com dois pavimentos, espaço ao ar livre e dormitórios amplos. Não é uma oferta disponível para locação.",
    features: ["Área externa", "Dois pavimentos", "Vagas de exemplo"]
  },
  {
    id: "demo-004", title: "Casa compacta para começar uma nova fase",
    type: "casa", region: "Centro (exemplo)", regionKey: "centro",
    rent: 1200, condominium: 0, iptu: null, feePeriod: "mensal",
    bedrooms: 1, bathrooms: 1, parking: 0, area: 45, image: "casa.svg",
    description: "Casa compacta de demonstração para verificar o funcionamento de filtros por faixa de preço e quantidade de cômodos.",
    features: ["Um dormitório", "Ambientes compactos", "Exemplo sintético"]
  },
  {
    id: "demo-005", title: "Apartamento com dois quartos",
    type: "apartamento", region: "Centro (exemplo)", regionKey: "centro",
    rent: 2100, condominium: 220, iptu: 90, feePeriod: "mensal",
    bedrooms: 2, bathrooms: 2, parking: 1, area: 78, image: "apartamento.svg",
    description: "Apartamento fictício para ilustrar a composição completa de aluguel, condomínio e IPTU quando os valores são conhecidos.",
    features: ["Dois banheiros", "Lavanderia", "Vaga coberta ilustrativa"]
  },
  {
    id: "demo-006", title: "Sobrado para quem busca mais espaço",
    type: "sobrado", region: "São Roque/SP — região ilustrativa", regionKey: "outras",
    rent: 3200, condominium: 0, iptu: 150, feePeriod: "mensal",
    bedrooms: 4, bathrooms: 3, parking: 2, area: 160, image: "sobrado.svg",
    description: "Exemplo acadêmico de imóvel amplo. Não é um anúncio publicado por proprietário ou imobiliária real.",
    features: ["Quatro dormitórios", "Área social", "Espaço amplo"]
  }
]);
