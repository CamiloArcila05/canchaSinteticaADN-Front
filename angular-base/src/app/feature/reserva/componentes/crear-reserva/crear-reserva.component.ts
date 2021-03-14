import {Component, OnInit} from '@angular/core';
import {FormControl, FormGroup, Validators} from '@angular/forms';
import {ActivatedRoute, Router} from '@angular/router';
import {Reserva} from '../../shared/model/reserva';
import {Cancha} from '../../../cancha/shared/model/cancha';
import {CanchaService} from '../../../cancha/shared/service/cancha.service';
import {ReservaService} from '../../shared/service/reserva.service';
import {NgxSpinnerService} from 'ngx-spinner';
import {ToastrService} from 'ngx-toastr';

@Component({
  selector: 'app-crear-reserva',
  templateUrl: './crear-reserva.component.html',
  styleUrls: ['./crear-reserva.component.scss']
})


export class CrearReservaComponent implements OnInit {

  reservaForm: FormGroup;
  canchas: Cancha[];
  horas: Array<string> = [
    '09:00', '10:00', '11:00', '12:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00',
  ];


  constructor(private router: Router,
              private reservaService: ReservaService,
              private canchaService: CanchaService,
              private spinner: NgxSpinnerService,
              private toast: ToastrService,
              private route: ActivatedRoute) {
  }

  ngOnInit(): void {
    this.cargaFormulario();
    this.canchaService.consultar()
      .subscribe(
        (response) => {
          this.canchas = response;
        });
  }

  cargaFormulario() {
    this.reservaForm = new FormGroup({
      nombreSolicita: new FormControl('', [Validators.required]),
      canchaId: new FormControl('', [Validators.required]),
      fecha: new FormControl('', [Validators.required]),
      hora: new FormControl('', [Validators.required]),
      valorAbono: new FormControl('', [Validators.required, Validators.min(1)]),
    });
  }


  cancelar() {
    this.router.navigate(['../../reserva'], {relativeTo: this.route});
  }

  crearReserva() {
    const formValues = this.reservaForm.getRawValue();
    console.log(formValues);
    const reserva = <Reserva> {
      canchaId: formValues.canchaId,
      fecha: formValues.fecha,
      hora: formValues.hora,
      estado: 'ACTIVO',
      nombreSolicita: formValues.nombreSolicita,
      valorAbono: formValues.valorAbono,
      valorTotal: 0,
    };
    this.spinner.show();
    this.reservaService.guardar(reserva)
      .subscribe(
        () => {
          this.spinner.hide();
          this.toast.success('La reserva del señor(a): ' + reserva.nombreSolicita + ' ha sido creada exitosamente', 'Éxito');
          this.cancelar();
        },
        (error) => {
          this.spinner.hide();
          if (error.error) {
            this.toast.error(error.error.mensaje, 'Error');
          } else {
            this.toast.error('Ocurrio un error inesperado, contacte al administrador del sistema', 'Error');
          }
        }
      );
  }


  convertFecha(): string {
    let fechaFormat = '';
    const fecha = this.reservaForm.getRawValue().fecha;
    const anio = fecha.year;
    const mes = fecha.month < 10 ? '0' + fecha.month : fecha.month;
    const dia = fecha.day < 10 ? '0' + fecha.day : fecha.day;
    fechaFormat += anio + '-' + mes + '-' + dia;
    return fechaFormat;
  }

}
