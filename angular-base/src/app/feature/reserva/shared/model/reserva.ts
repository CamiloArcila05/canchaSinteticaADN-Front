export class Reserva {
  id: number;
  canchaId: number;
  estado: string;
  fecha: string;
  hora: string;
  nombreSolicita: string;
  valorAbono: number;
  valorTotal: number;


  constructor(id: number, canchaId: number, estado: string, fecha: string, hora: string, nombreSolicita: string, valorAbono: number, valorTotal: number) {
    this.id = id;
    this.canchaId = canchaId;
    this.estado = estado;
    this.fecha = fecha;
    this.hora = hora;
    this.nombreSolicita = nombreSolicita;
    this.valorAbono = valorAbono;
    this.valorTotal = valorTotal;
  }
}
