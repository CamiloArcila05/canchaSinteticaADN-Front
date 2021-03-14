import { Injectable } from '@angular/core';
import { HttpService } from '@core-service/http.service';
import { environment } from 'src/environments/environment';
import {Observable} from "rxjs";
import {Reserva} from "../model/reserva";
import {HttpHeaders, HttpParams} from "@angular/common/http";


@Injectable({
  providedIn: 'root'
})
export class ReservaService {

  constructor(protected http: HttpService) {}

  public consultar(): Observable<Reserva[]> {
    return this.http.doGet<Reserva[]>(`${environment.endpointReserva}/listar-reservas`, this.http.optsName('listar canchas'));
  }

  public guardar(reserva: Reserva) {
    return this.http.doPost<Reserva, boolean>(`${environment.endpointReserva}/registrar-reserva`, reserva,
      this.http.optsName('crear/registrar reservas'));
  }

  public cancelar(reservaId: any) {
    const opts = {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
      params: new HttpParams().set('reservaId', reservaId)
    };
    return this.http.doPut<Reserva, boolean>(`${environment.endpointReserva}/cancelar-reserva`, null, opts);
  }

  public finalizar(reservaId: any, valorIngresado: any) {
    const opts = {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
      params: new HttpParams().set('reservaId', reservaId).set('valorIngresado', valorIngresado)
    };
    return this.http.doPut<Reserva, boolean>(`${environment.endpointReserva}/finalizar-reserva`, null, opts);
  }

  public eliminar(reserva: Reserva) {
    return this.http.doDelete<boolean>(`${environment.endpointReserva}/productos/${reserva.id}`,
      this.http.optsName('eliminar productos'));
  }
}
