export class Cancha {

  id: number;
  nombre: string;
  descripcion: string;
  estado: string;
  valorDia: number;
  valorNoche: number;


  constructor(id: number, nombre: string, descripcion: string, estado: string, valorDia: number, valorNoche: number) {
    this.id = id;
    this.nombre = nombre;
    this.descripcion = descripcion;
    this.estado = estado;
    this.valorDia = valorDia;
    this.valorNoche = valorNoche;
  }
}
