Mantém a sessão viva (2–5 min aleatório), registra no console cada ping e alerta com som/notificação quando a fila aumenta. Pisca 1s alternando vermelho/verde com som a cada 15s enquanto fila>0 em /pendente/23. Criado por Heyron Carneiro - B.I.


v1.7.0: chat sem painel (somente overlay NOVO ATENDIMENTO NA FILA;
pisca 1s alternando vermelho/verde; 
som a cada 15s enquanto fila>0). /pendente/23 com Fila + Histórico (duas colunas). 
Painel montado APÓS <app-topbar>. Tema verde=0 / vermelho=>0. Ping único com ETA e fallbacks sem 405.

teste console:
window.postMessage({__ka:true, type:'QUEUE_UPDATE', prev:1, curr:5}, '*');